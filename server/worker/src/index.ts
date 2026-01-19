import {
    ChatError,
    ErrorCode,
    generateSessionId,
} from '@claude-chat/protocol';

import type { Env } from './types.js';
import type { RateLimitResult } from './rate-limiter.js';
import { checkRateLimit } from './rate-limit-do.js';

export { SessionDO } from './session-do.js';
export { RateLimitDO } from './rate-limit-do.js';

/**
 * Maximum request body size in bytes (100KB).
 * This is well above the 50KB message limit to allow for JSON overhead.
 */
const MAX_BODY_SIZE = 100 * 1024;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Password, X-Admin-Password, X-Auth-Token, Authorization',
};

/**
 * Generate a unique request ID for tracing.
 */
function generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Structured logging helper.
 */
function log(
    level: 'info' | 'warn' | 'error',
    message: string,
    context: Record<string, unknown> = {}
): void {
    const entry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...context,
    };
    if (level === 'error') {
        console.error(JSON.stringify(entry));
    } else if (level === 'warn') {
        console.warn(JSON.stringify(entry));
    } else {
        console.log(JSON.stringify(entry));
    }
}

interface ResponseOptions {
    status?: number;
    requestId?: string;
    rateLimit?: RateLimitResult;
}

function jsonResponse(data: unknown, options: ResponseOptions = {}): Response {
    const { status = 200, requestId, rateLimit } = options;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
    };

    if (requestId) {
        headers['X-Request-ID'] = requestId;
    }

    if (rateLimit) {
        headers['X-RateLimit-Remaining'] = String(rateLimit.remaining);
        headers['X-RateLimit-Reset'] = String(Math.ceil(rateLimit.resetAt / 1000));
    }

    return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(
    code: string,
    message: string,
    status = 400,
    options: ResponseOptions = {}
): Response {
    return jsonResponse({ error: code, message }, { ...options, status });
}

/**
 * Check if request body exceeds maximum size.
 * Returns null if OK, or an error response if too large.
 */
function checkBodySize(request: Request, requestId: string): Response | null {
    const contentLength = request.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
        return errorResponse(
            ErrorCode.VALIDATION_ERROR,
            `Request body too large. Maximum size is ${MAX_BODY_SIZE} bytes.`,
            413,
            { requestId }
        );
    }
    return null;
}

/**
 * Check staging auth token if in staging environment.
 * Returns null if OK, or 401 response if unauthorized.
 */
function checkStagingAuth(request: Request, env: Env, requestId: string): Response | null {
    if (env.ENVIRONMENT !== 'staging' || !env.STAGING_AUTH_TOKEN) {
        return null;
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        log('warn', 'Missing auth header on staging', { requestId });
        return errorResponse('UNAUTHORIZED', 'Missing or invalid Authorization header', 401, { requestId });
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    if (token !== env.STAGING_AUTH_TOKEN) {
        log('warn', 'Invalid auth token on staging', { requestId });
        return errorResponse('UNAUTHORIZED', 'Invalid token', 401, { requestId });
    }

    return null;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const requestId = generateRequestId();
        const startTime = Date.now();
        const url = new URL(request.url);
        const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        try {
            // Check body size for POST requests
            if (request.method === 'POST') {
                const sizeError = checkBodySize(request, requestId);
                if (sizeError) return sizeError;
            }

            if (url.pathname === '/health') {
                return jsonResponse({ status: 'ok', timestamp: Date.now() }, { requestId });
            }

            // Check staging auth for all routes except /health
            const authError = checkStagingAuth(request, env, requestId);
            if (authError) return authError;

            if (url.pathname.startsWith('/api/')) {
                const response = await handleAPI(request, env, url, requestId, clientIp);
                const duration = Date.now() - startTime;
                log('info', 'Request completed', {
                    requestId,
                    method: request.method,
                    path: url.pathname,
                    status: response.status,
                    duration,
                    clientIp,
                });
                return response;
            }

            return errorResponse('NOT_FOUND', 'Not found', 404, { requestId });
        } catch (error) {
            const duration = Date.now() - startTime;
            log('error', 'Unhandled error', {
                requestId,
                method: request.method,
                path: url.pathname,
                error: error instanceof Error ? error.message : String(error),
                duration,
                clientIp,
            });
            if (error instanceof ChatError) {
                return jsonResponse(error.toResponse(), { status: error.httpStatus, requestId });
            }
            return errorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500, { requestId });
        }
    },
};

async function handleAPI(
    request: Request,
    env: Env,
    url: URL,
    requestId: string,
    clientIp: string
): Promise<Response> {
    const path = url.pathname.replace('/api', '');
    const method = request.method;

    if (path === '/sessions' && method === 'POST') {
        return handleCreateSession(request, env, requestId, clientIp);
    }

    const sessionMatch = path.match(/^\/sessions\/([^/]+)(\/.*)?$/);
    if (!sessionMatch || !sessionMatch[1]) {
        return errorResponse('NOT_FOUND', 'Not found', 404, { requestId });
    }

    const sessionId = sessionMatch[1];
    const subPath = sessionMatch[2] ?? '/';

    const doId = env.SESSION.idFromName(sessionId);
    const stub = env.SESSION.get(doId);

    let internalPath = subPath;
    if (subPath.startsWith('/participants/')) {
        const participantId = subPath.replace('/participants/', '');
        internalPath = `/participants/${participantId}`;
    }

    const internalUrl = new URL(request.url);
    internalUrl.pathname = internalPath;

    const internalRequest = new Request(internalUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
    });

    const response = await stub.fetch(internalRequest);

    const responseBody = await response.text();
    return new Response(responseBody, {
        status: response.status,
        headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            ...CORS_HEADERS,
        },
    });
}

async function handleCreateSession(
    request: Request,
    env: Env,
    requestId: string,
    clientIp: string
): Promise<Response> {
    // Rate limit session creation by IP
    const rateLimitResult = await checkRateLimit(env.RATE_LIMIT, `create:${clientIp}`);
    if (!rateLimitResult.allowed) {
        log('warn', 'Rate limit exceeded for session creation', { requestId, clientIp });
        return errorResponse(
            ErrorCode.RATE_LIMITED,
            'Too many session creation requests. Please try again later.',
            429,
            { requestId, rateLimit: rateLimitResult }
        );
    }

    const sessionId = generateSessionId();
    const doId = env.SESSION.idFromName(sessionId);
    const stub = env.SESSION.get(doId);

    const internalUrl = new URL(request.url);
    internalUrl.pathname = '/create';
    internalUrl.searchParams.set('session_id', sessionId);

    const internalRequest = new Request(internalUrl.toString(), {
        method: 'POST',
        headers: request.headers,
        body: request.body,
    });

    const response = await stub.fetch(internalRequest);

    const responseBody = await response.text();
    return new Response(responseBody, {
        status: response.status,
        headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(Math.ceil(rateLimitResult.resetAt / 1000)),
            ...CORS_HEADERS,
        },
    });
}
