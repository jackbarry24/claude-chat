import {
  ChatError,
  ErrorCode,
  hashPassword,
  verifyPassword,
  generateParticipantId,
  generateMessageId,
  generatePassword,
  SESSION_TTL_MS,
  MAX_MESSAGES,
  MAX_PARTICIPANTS,
  CreateSessionRequestSchema,
  JoinSessionRequestSchema,
  SendMessageRequestSchema,
  ReadMessagesQuerySchema,
  RemoveParticipantRequestSchema,
  formatZodErrors,
  toParticipantInfo,
  toMessageInfo,
  type ParticipantLike,
  type CreateSessionResponse,
  type JoinSessionResponse,
  type SendMessageResponse,
  type ReadMessagesResponse,
  type ListParticipantsResponse,
  type SuccessResponse,
  type EndSessionResponse,
  type SessionInfoResponse,
} from '@claude-chat/protocol';

import {
  type Env,
  type StoredSession,
  type StoredParticipant,
  type StoredMessage,
  STORAGE_KEYS,
} from './types.js';

import { RateLimiter, RATE_LIMITS } from './rate-limiter.js';

export class SessionDO implements DurableObject {
  private state: DurableObjectState;
  private session: StoredSession | null = null;
  private participants: Map<string, StoredParticipant> = new Map();
  private messages: StoredMessage[] = [];
  private readCursors: Map<string, string> = new Map();
  private initialized = false;

  // Rate limiters (in-memory, reset on DO eviction which is acceptable)
  private joinLimiter = new RateLimiter(RATE_LIMITS.SESSION_JOIN);
  private sendLimiter = new RateLimiter(RATE_LIMITS.MESSAGE_SEND);
  private readLimiter = new RateLimiter(RATE_LIMITS.MESSAGE_READ);
  private generalLimiter = new RateLimiter(RATE_LIMITS.GENERAL);

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  /**
   * Check rate limit and throw if exceeded.
   */
  private checkRateLimit(limiter: RateLimiter, key: string, operation: string): void {
    const result = limiter.check(key);
    if (!result.allowed) {
      throw new ChatError(
        `Rate limit exceeded for ${operation}. Try again later.`,
        ErrorCode.RATE_LIMITED,
        429
      );
    }
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    const [session, participants, messages, readCursors] = await Promise.all([
      this.state.storage.get<StoredSession>(STORAGE_KEYS.SESSION),
      this.state.storage.get<Record<string, StoredParticipant>>(STORAGE_KEYS.PARTICIPANTS),
      this.state.storage.get<StoredMessage[]>(STORAGE_KEYS.MESSAGES),
      this.state.storage.get<Record<string, string>>(STORAGE_KEYS.READ_CURSORS),
    ]);

    this.session = session ?? null;
    this.participants = new Map(Object.entries(participants ?? {}));
    this.messages = messages ?? [];
    this.readCursors = new Map(Object.entries(readCursors ?? {}));
    this.initialized = true;
  }

  private async save(): Promise<void> {
    await this.state.storage.put({
      [STORAGE_KEYS.SESSION]: this.session,
      [STORAGE_KEYS.PARTICIPANTS]: Object.fromEntries(this.participants),
      [STORAGE_KEYS.MESSAGES]: this.messages,
      [STORAGE_KEYS.READ_CURSORS]: Object.fromEntries(this.readCursors),
    });
  }

  private updateActivity(): void {
    if (this.session && !this.session.ended) {
      this.session.lastActivity = Date.now();
      this.session.expiresAt = Date.now() + SESSION_TTL_MS;
    }
  }

  private isExpired(): boolean {
    return this.session !== null && Date.now() > this.session.expiresAt;
  }

  private jsonResponse<T>(data: T, status = 200): Response {
    return Response.json(data, { status });
  }

  private errorResponse(error: ChatError): Response {
    return Response.json(error.toResponse(), { status: error.httpStatus });
  }

  async fetch(request: Request): Promise<Response> {
    await this.initialize();

    const url = new URL(request.url);
    const method = request.method;
    // Get client IP for rate limiting (Cloudflare provides this header)
    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';

    try {
      // Apply general rate limit to all requests
      this.checkRateLimit(this.generalLimiter, clientIp, 'requests');

      if (method === 'POST' && url.pathname === '/create') {
        return await this.handleCreate(request);
      }

      if (this.session === null || this.isExpired() || this.session.ended) {
        throw new ChatError('Session not found', ErrorCode.SESSION_NOT_FOUND, 404);
      }

      if (method === 'POST' && url.pathname === '/join') {
        // Extra rate limit on join to prevent password brute force
        this.checkRateLimit(this.joinLimiter, clientIp, 'join attempts');
        return await this.handleJoin(request);
      }
      if (method === 'POST' && url.pathname === '/messages') {
        return await this.handleSendMessage(request);
      }
      if (method === 'GET' && url.pathname === '/messages') {
        return await this.handleReadMessages(request);
      }
      if (method === 'GET' && url.pathname === '/participants') {
        return await this.handleListParticipants(request);
      }
      if (method === 'GET' && url.pathname === '/') {
        return await this.handleGetSessionInfo(request);
      }
      if (method === 'DELETE' && url.pathname.startsWith('/participants/')) {
        return await this.handleRemoveParticipant(request, url);
      }
      if (method === 'DELETE' && url.pathname === '/') {
        return await this.handleEndSession(request);
      }

      return Response.json({ error: 'NOT_FOUND', message: 'Not found' }, { status: 404 });
    } catch (error) {
      if (error instanceof ChatError) {
        return this.errorResponse(error);
      }
      console.error('Unexpected error:', error);
      return Response.json(
        { error: ErrorCode.INTERNAL_ERROR, message: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  private async handleCreate(request: Request): Promise<Response> {
    if (this.session !== null) {
      throw new ChatError('Session already exists', ErrorCode.INTERNAL_ERROR, 400);
    }

    const body = await request.json();
    const parsed = CreateSessionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ChatError(formatZodErrors(parsed.error), ErrorCode.VALIDATION_ERROR, 400);
    }

    const { display_name } = parsed.data;
    const sessionId = new URL(request.url).searchParams.get('session_id')!;
    const sessionPassword = generatePassword();
    const adminPassword = generatePassword();

    const [passwordHash, adminPasswordHash] = await Promise.all([
      hashPassword(sessionPassword),
      hashPassword(adminPassword),
    ]);

    const participantId = generateParticipantId();
    const now = Date.now();

    this.session = {
      id: sessionId,
      passwordHash,
      adminPasswordHash,
      createdAt: now,
      createdBy: participantId,
      expiresAt: now + SESSION_TTL_MS,
      lastActivity: now,
      ended: false,
    };

    const participant: StoredParticipant = {
      id: participantId,
      displayName: display_name,
      joinedAt: now,
      lastSeen: now,
      isAdmin: true,
    };
    this.participants.set(participantId, participant);

    await this.save();

    const response: CreateSessionResponse = {
      session_id: sessionId,
      session_password: sessionPassword,
      admin_password: adminPassword,
      participant_id: participantId,
      created_at: this.session.createdAt,
      expires_at: this.session.expiresAt,
    };

    return this.jsonResponse(response, 201);
  }

  private async handleJoin(request: Request): Promise<Response> {
    const sessionPassword = request.headers.get('X-Session-Password');
    if (!sessionPassword) {
      throw new ChatError('Session password required', ErrorCode.INVALID_PASSWORD, 401);
    }

    const validPassword = await verifyPassword(sessionPassword, this.session!.passwordHash);
    if (!validPassword) {
      throw new ChatError('Invalid session password', ErrorCode.INVALID_PASSWORD, 401);
    }

    const body = await request.json();
    const parsed = JoinSessionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ChatError(formatZodErrors(parsed.error), ErrorCode.VALIDATION_ERROR, 400);
    }

    const { display_name } = parsed.data;

    if (this.participants.size >= MAX_PARTICIPANTS) {
      throw new ChatError(
        `Session is full (max ${MAX_PARTICIPANTS} participants)`,
        ErrorCode.SESSION_FULL,
        403
      );
    }

    this.updateActivity();

    const participantId = generateParticipantId();
    const now = Date.now();

    const participant: StoredParticipant = {
      id: participantId,
      displayName: display_name,
      joinedAt: now,
      lastSeen: now,
      isAdmin: false,
    };
    this.participants.set(participantId, participant);

    await this.save();

    const participantsList = Array.from(this.participants.values()).map((p) =>
      toParticipantInfo(p)
    );

    const response: JoinSessionResponse = {
      success: true,
      participant_id: participantId,
      participants: participantsList,
    };

    return this.jsonResponse(response);
  }

  private async handleSendMessage(request: Request): Promise<Response> {
    const sessionPassword = request.headers.get('X-Session-Password');
    if (!sessionPassword) {
      throw new ChatError('Session password required', ErrorCode.INVALID_PASSWORD, 401);
    }

    const validPassword = await verifyPassword(sessionPassword, this.session!.passwordHash);
    if (!validPassword) {
      throw new ChatError('Invalid session password', ErrorCode.INVALID_PASSWORD, 401);
    }

    const body = await request.json();
    const parsed = SendMessageRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ChatError(formatZodErrors(parsed.error), ErrorCode.VALIDATION_ERROR, 400);
    }

    const { participant_id, content } = parsed.data;

    // Rate limit per participant for message sending
    this.checkRateLimit(this.sendLimiter, participant_id, 'message sending');

    const participant = this.participants.get(participant_id);
    if (!participant) {
      throw new ChatError('Not a participant in this session', ErrorCode.NOT_PARTICIPANT, 403);
    }

    this.updateActivity();
    participant.lastSeen = Date.now();

    const messageId = generateMessageId();
    const timestamp = Date.now();

    const message: StoredMessage = {
      id: messageId,
      from: participant_id,
      content,
      timestamp,
    };

    this.messages.push(message);

    if (this.messages.length > MAX_MESSAGES) {
      this.messages = this.messages.slice(-MAX_MESSAGES);
    }

    await this.save();

    const response: SendMessageResponse = {
      success: true,
      message_id: messageId,
      timestamp,
    };

    return this.jsonResponse(response, 201);
  }

  private async handleReadMessages(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionPassword = request.headers.get('X-Session-Password');

    if (!sessionPassword) {
      throw new ChatError('Session password required', ErrorCode.INVALID_PASSWORD, 401);
    }

    const validPassword = await verifyPassword(sessionPassword, this.session!.passwordHash);
    if (!validPassword) {
      throw new ChatError('Invalid session password', ErrorCode.INVALID_PASSWORD, 401);
    }

    const queryParams: Record<string, string | undefined> = {
      participant_id: url.searchParams.get('participant_id') ?? undefined,
    };
    const limitParam = url.searchParams.get('limit');
    if (limitParam !== null) {
      queryParams.limit = limitParam;
    }
    const afterParam = url.searchParams.get('after');
    if (afterParam !== null) {
      queryParams.after = afterParam;
    }

    const parsed = ReadMessagesQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      throw new ChatError(formatZodErrors(parsed.error), ErrorCode.VALIDATION_ERROR, 400);
    }

    const { participant_id, after, limit } = parsed.data;

    // Rate limit per participant for message reading
    this.checkRateLimit(this.readLimiter, participant_id, 'message reading');

    const participant = this.participants.get(participant_id);
    if (!participant) {
      throw new ChatError('Not a participant in this session', ErrorCode.NOT_PARTICIPANT, 403);
    }

    this.updateActivity();
    participant.lastSeen = Date.now();

    const cursor = after ?? this.readCursors.get(participant_id) ?? null;

    let startIndex = 0;
    if (cursor) {
      const cursorIndex = this.messages.findIndex((m) => m.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const messagesSlice = this.messages.slice(startIndex, startIndex + limit + 1);
    const hasMore = messagesSlice.length > limit;
    const returnMessages = hasMore ? messagesSlice.slice(0, limit) : messagesSlice;

    const lastMessage = returnMessages[returnMessages.length - 1];
    if (lastMessage) {
      this.readCursors.set(participant_id, lastMessage.id);
    }

    await this.save();

    const participantsMap: Map<string, ParticipantLike> = new Map(this.participants);

    const response: ReadMessagesResponse = {
      messages: returnMessages.map((m) => toMessageInfo(m, participantsMap)),
      next_cursor: lastMessage?.id ?? null,
      has_more: hasMore,
    };

    return this.jsonResponse(response);
  }

  private async handleListParticipants(request: Request): Promise<Response> {
    const sessionPassword = request.headers.get('X-Session-Password');

    if (!sessionPassword) {
      throw new ChatError('Session password required', ErrorCode.INVALID_PASSWORD, 401);
    }

    const validPassword = await verifyPassword(sessionPassword, this.session!.passwordHash);
    if (!validPassword) {
      throw new ChatError('Invalid session password', ErrorCode.INVALID_PASSWORD, 401);
    }

    this.updateActivity();
    await this.save();

    const participantsList = Array.from(this.participants.values()).map((p) =>
      toParticipantInfo(p)
    );

    const response: ListParticipantsResponse = {
      participants: participantsList,
    };

    return this.jsonResponse(response);
  }

  private async handleGetSessionInfo(request: Request): Promise<Response> {
    const sessionPassword = request.headers.get('X-Session-Password');

    if (!sessionPassword) {
      throw new ChatError('Session password required', ErrorCode.INVALID_PASSWORD, 401);
    }

    const validPassword = await verifyPassword(sessionPassword, this.session!.passwordHash);
    if (!validPassword) {
      throw new ChatError('Invalid session password', ErrorCode.INVALID_PASSWORD, 401);
    }

    this.updateActivity();
    await this.save();

    const response: SessionInfoResponse = {
      session_id: this.session!.id,
      created_at: this.session!.createdAt,
      expires_at: this.session!.expiresAt,
      participant_count: this.participants.size,
      message_count: this.messages.length,
      is_ended: this.session!.ended,
    };

    return this.jsonResponse(response);
  }

  private async handleRemoveParticipant(request: Request, url: URL): Promise<Response> {
    const participantId = url.pathname.replace('/participants/', '');

    const sessionPassword = request.headers.get('X-Session-Password');
    const adminPassword = request.headers.get('X-Admin-Password');

    if (!sessionPassword) {
      throw new ChatError('Session password required', ErrorCode.INVALID_PASSWORD, 401);
    }

    const validSessionPassword = await verifyPassword(sessionPassword, this.session!.passwordHash);
    if (!validSessionPassword) {
      throw new ChatError('Invalid session password', ErrorCode.INVALID_PASSWORD, 401);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = RemoveParticipantRequestSchema.safeParse({
      session_password: sessionPassword,
      admin_password: adminPassword ?? (body as Record<string, unknown>).admin_password,
    });

    if (!parsed.success) {
      throw new ChatError(formatZodErrors(parsed.error), ErrorCode.VALIDATION_ERROR, 400);
    }

    const targetParticipant = this.participants.get(participantId);
    if (!targetParticipant) {
      throw new ChatError('Participant not found', ErrorCode.PARTICIPANT_NOT_FOUND, 404);
    }

    const requestingParticipantId = url.searchParams.get('requester_id');
    const isSelfRemoval = requestingParticipantId === participantId;

    if (!isSelfRemoval) {
      const providedAdminPassword = parsed.data.admin_password;
      if (!providedAdminPassword) {
        throw new ChatError(
          'Admin password required to remove other participants',
          ErrorCode.ADMIN_REQUIRED,
          403
        );
      }

      const validAdmin = await verifyPassword(providedAdminPassword, this.session!.adminPasswordHash);
      if (!validAdmin) {
        throw new ChatError('Invalid admin password', ErrorCode.ADMIN_REQUIRED, 403);
      }
    }

    this.participants.delete(participantId);
    this.readCursors.delete(participantId);
    this.updateActivity();

    await this.save();

    const response: SuccessResponse = {
      success: true,
    };

    return this.jsonResponse(response);
  }

  private async handleEndSession(request: Request): Promise<Response> {
    const adminPassword = request.headers.get('X-Admin-Password');

    if (!adminPassword) {
      throw new ChatError('Admin password required', ErrorCode.ADMIN_REQUIRED, 403);
    }

    const validAdmin = await verifyPassword(adminPassword, this.session!.adminPasswordHash);
    if (!validAdmin) {
      throw new ChatError('Invalid admin password', ErrorCode.ADMIN_REQUIRED, 403);
    }

    this.session!.ended = true;
    await this.save();

    const response: EndSessionResponse = {
      success: true,
      message: 'Session ended',
    };

    return this.jsonResponse(response);
  }
}
