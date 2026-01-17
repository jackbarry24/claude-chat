import {
    ChatError,
    ErrorCode,
    generateSessionId,
} from '@claude-chat/protocol';

import type { Env } from './types.js';

export { SessionDO } from './session-do.js';

/**
 * Maximum request body size in bytes (100KB).
 * This is well above the 50KB message limit to allow for JSON overhead.
 */
const MAX_BODY_SIZE = 100 * 1024;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Password, X-Admin-Password',
};

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
        },
    });
}

function errorResponse(code: string, message: string, status = 400): Response {
    return jsonResponse({ error: code, message }, status);
}

/**
 * Check if request body exceeds maximum size.
 * Returns null if OK, or an error response if too large.
 */
async function checkBodySize(request: Request): Promise<Response | null> {
    const contentLength = request.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
        return errorResponse(
            ErrorCode.VALIDATION_ERROR,
            `Request body too large. Maximum size is ${MAX_BODY_SIZE} bytes.`,
            413
        );
    }
    return null;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        try {
            // Check body size for POST requests
            if (request.method === 'POST') {
                const sizeError = await checkBodySize(request);
                if (sizeError) return sizeError;
            }

            if (url.pathname === '/health') {
                return jsonResponse({ status: 'ok', timestamp: Date.now() });
            }

            if (url.pathname.startsWith('/api/')) {
                return handleAPI(request, env, url);
            }

            return errorResponse('NOT_FOUND', 'Not found', 404);
        } catch (error) {
            console.error('Unhandled error:', error);
            if (error instanceof ChatError) {
                return jsonResponse(error.toResponse(), error.httpStatus);
            }
            return errorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
        }
    },
};

async function handleAPI(request: Request, env: Env, url: URL): Promise<Response> {
    const path = url.pathname.replace('/api', '');
    const method = request.method;

    if (path === '/sessions' && method === 'POST') {
        return handleCreateSession(request, env);
    }

    const sessionMatch = path.match(/^\/sessions\/([^/]+)(\/.*)?$/);
    if (!sessionMatch || !sessionMatch[1]) {
        return errorResponse('NOT_FOUND', 'Not found', 404);
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
            ...CORS_HEADERS,
        },
    });
}

async function handleCreateSession(request: Request, env: Env): Promise<Response> {
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
            ...CORS_HEADERS,
        },
    });
}
