import { describe, it, expect, beforeEach } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../src/index.js';

describe('Session API', () => {
  const ctx = createExecutionContext();

  async function createSession(displayName = 'Test User') {
    const request = new Request('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName }),
    });
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    return response;
  }

  async function joinSession(sessionId: string, sessionPassword: string, displayName = 'Joiner') {
    const request = new Request(`http://localhost/api/sessions/${sessionId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Password': sessionPassword,
      },
      body: JSON.stringify({ display_name: displayName }),
    });
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    return response;
  }

  async function sendMessage(
    sessionId: string,
    sessionPassword: string,
    authToken: string,
    participantId: string,
    content: string
  ) {
    const request = new Request(`http://localhost/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Password': sessionPassword,
        'X-Auth-Token': authToken,
      },
      body: JSON.stringify({
        participant_id: participantId,
        content,
      }),
    });
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    return response;
  }

  async function readMessages(
    sessionId: string,
    sessionPassword: string,
    authToken: string,
    participantId: string
  ) {
    const request = new Request(
      `http://localhost/api/sessions/${sessionId}/messages?participant_id=${participantId}`,
      {
        method: 'GET',
        headers: { 'X-Session-Password': sessionPassword, 'X-Auth-Token': authToken },
      }
    );
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    return response;
  }

  describe('POST /api/sessions', () => {
    it('should create a new session', async () => {
      const response = await createSession('Alice');
      expect(response.status).toBe(201);

      const data = await response.json() as {
        session_id: string;
        session_password: string;
        admin_password: string;
        participant_id: string;
        auth_token: string;
        created_at: number;
        expires_at: number;
      };

      expect(data.session_id).toBeTruthy();
      expect(data.session_password).toBeTruthy();
      expect(data.admin_password).toBeTruthy();
      expect(data.participant_id).toMatch(/^p_/);
      expect(data.auth_token).toBeTruthy();
      expect(data.created_at).toBeGreaterThan(0);
      expect(data.expires_at).toBeGreaterThan(data.created_at);
    });

    it('should reject missing display_name', async () => {
      const request = new Request('http://localhost/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/sessions/:id/join', () => {
    it('should allow joining with valid password', async () => {
      const createResponse = await createSession('Alice');
      const { session_id, session_password } = await createResponse.json() as {
        session_id: string;
        session_password: string;
      };

      const joinResponse = await joinSession(session_id, session_password, 'Bob');
      expect(joinResponse.status).toBe(200);

      const data = await joinResponse.json() as {
        success: boolean;
        participant_id: string;
        auth_token: string;
        participants: Array<{ id: string; display_name: string }>;
      };

      expect(data.success).toBe(true);
      expect(data.participant_id).toMatch(/^p_/);
      expect(data.auth_token).toBeTruthy();
      expect(data.participants).toHaveLength(2);
    });

    it('should reject invalid password', async () => {
      const createResponse = await createSession('Alice');
      const { session_id } = await createResponse.json() as { session_id: string };

      const joinResponse = await joinSession(session_id, 'wrong-password', 'Bob');
      expect(joinResponse.status).toBe(401);
    });

    it('should return 404 for non-existent session', async () => {
      const joinResponse = await joinSession('nonexistent', 'password', 'Bob');
      expect(joinResponse.status).toBe(404);
    });

    it('should reject when session is full (max 3 participants)', async () => {
      const createResponse = await createSession('Alice');
      const { session_id, session_password } = await createResponse.json() as {
        session_id: string;
        session_password: string;
      };

      await joinSession(session_id, session_password, 'Bob');
      await joinSession(session_id, session_password, 'Charlie');

      const joinResponse = await joinSession(session_id, session_password, 'Dave');
      expect(joinResponse.status).toBe(403);

      const data = await joinResponse.json() as { error: string };
      expect(data.error).toBe('SESSION_FULL');
    });
  });

  describe('POST /api/sessions/:id/messages', () => {
    it('should send a message', async () => {
      const createResponse = await createSession('Alice');
      const { session_id, session_password, participant_id, auth_token } = await createResponse.json() as {
        session_id: string;
        session_password: string;
        participant_id: string;
        auth_token: string;
      };

      const sendResponse = await sendMessage(
        session_id,
        session_password,
        auth_token,
        participant_id,
        'Hello, world!'
      );
      expect(sendResponse.status).toBe(201);

      const data = await sendResponse.json() as {
        success: boolean;
        message_id: string;
        timestamp: number;
      };

      expect(data.success).toBe(true);
      expect(data.message_id).toMatch(/^m_/);
      expect(data.timestamp).toBeGreaterThan(0);
    });

    it('should reject message from non-participant', async () => {
      const createResponse = await createSession('Alice');
      const { session_id, session_password, auth_token } = await createResponse.json() as {
        session_id: string;
        session_password: string;
        auth_token: string;
      };

      const sendResponse = await sendMessage(
        session_id,
        session_password,
        auth_token,
        'p_nonexistent',
        'Hello!'
      );
      expect(sendResponse.status).toBe(403);
    });
  });

  describe('GET /api/sessions/:id/messages', () => {
    it('should read messages', async () => {
      const createResponse = await createSession('Alice');
      const { session_id, session_password, participant_id, auth_token } = await createResponse.json() as {
        session_id: string;
        session_password: string;
        participant_id: string;
        auth_token: string;
      };

      await sendMessage(session_id, session_password, auth_token, participant_id, 'Message 1');
      await sendMessage(session_id, session_password, auth_token, participant_id, 'Message 2');

      const readResponse = await readMessages(session_id, session_password, auth_token, participant_id);
      expect(readResponse.status).toBe(200);

      const data = await readResponse.json() as {
        messages: Array<{ id: string; content: string }>;
        has_more: boolean;
      };

      expect(data.messages).toHaveLength(2);
      expect(data.messages[0].content).toBe('Message 1');
      expect(data.messages[1].content).toBe('Message 2');
      expect(data.has_more).toBe(false);
    });

    it('should track read cursor', async () => {
      const createResponse = await createSession('Alice');
      const { session_id, session_password, participant_id, auth_token } = await createResponse.json() as {
        session_id: string;
        session_password: string;
        participant_id: string;
        auth_token: string;
      };

      await sendMessage(session_id, session_password, auth_token, participant_id, 'Message 1');

      const read1 = await readMessages(session_id, session_password, auth_token, participant_id);
      const data1 = await read1.json() as { messages: Array<{ id: string }> };
      expect(data1.messages).toHaveLength(1);

      const read2 = await readMessages(session_id, session_password, auth_token, participant_id);
      const data2 = await read2.json() as { messages: Array<{ id: string }> };
      expect(data2.messages).toHaveLength(0);

      await sendMessage(session_id, session_password, auth_token, participant_id, 'Message 2');

      const read3 = await readMessages(session_id, session_password, auth_token, participant_id);
      const data3 = await read3.json() as { messages: Array<{ id: string; content: string }> };
      expect(data3.messages).toHaveLength(1);
      expect(data3.messages[0].content).toBe('Message 2');
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('should end session with admin password', async () => {
      const createResponse = await createSession('Alice');
      const { session_id, admin_password } = await createResponse.json() as {
        session_id: string;
        admin_password: string;
      };

      const endRequest = new Request(`http://localhost/api/sessions/${session_id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': admin_password },
      });
      const endResponse = await worker.fetch(endRequest, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(endResponse.status).toBe(200);

      const joinResponse = await joinSession(session_id, 'any-password', 'Bob');
      expect(joinResponse.status).toBe(404);
    });

    it('should reject without admin password', async () => {
      const createResponse = await createSession('Alice');
      const { session_id } = await createResponse.json() as { session_id: string };

      const endRequest = new Request(`http://localhost/api/sessions/${session_id}`, {
        method: 'DELETE',
      });
      const endResponse = await worker.fetch(endRequest, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(endResponse.status).toBe(403);
    });
  });

  describe('DELETE /api/sessions/:id/participants/:pid', () => {
    it('should allow participant to leave (self-removal)', async () => {
      const createResponse = await createSession('Alice');
      const { session_id, session_password } = await createResponse.json() as {
        session_id: string;
        session_password: string;
      };

      const joinResponse = await joinSession(session_id, session_password, 'Bob');
      const { participant_id: bobId, auth_token: bobAuthToken } = await joinResponse.json() as {
        participant_id: string;
        auth_token: string;
      };

      const leaveRequest = new Request(
        `http://localhost/api/sessions/${session_id}/participants/${bobId}`,
        {
          method: 'DELETE',
          headers: { 'X-Session-Password': session_password, 'X-Auth-Token': bobAuthToken },
        }
      );
      const leaveResponse = await worker.fetch(leaveRequest, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(leaveResponse.status).toBe(200);
      const data = await leaveResponse.json() as { success: boolean };
      expect(data.success).toBe(true);
    });

    it('should allow admin to remove other participant', async () => {
      const createResponse = await createSession('Alice');
      const { session_id, session_password, admin_password, participant_id: aliceId, auth_token: aliceAuthToken } = await createResponse.json() as {
        session_id: string;
        session_password: string;
        admin_password: string;
        participant_id: string;
        auth_token: string;
      };

      const joinResponse = await joinSession(session_id, session_password, 'Bob');
      const { participant_id: bobId } = await joinResponse.json() as { participant_id: string };

      const removeRequest = new Request(
        `http://localhost/api/sessions/${session_id}/participants/${bobId}`,
        {
          method: 'DELETE',
          headers: {
            'X-Session-Password': session_password,
            'X-Auth-Token': aliceAuthToken,
            'X-Admin-Password': admin_password,
          },
        }
      );
      const removeResponse = await worker.fetch(removeRequest, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(removeResponse.status).toBe(200);
    });

    it('should reject non-admin removing other participant without admin password', async () => {
      const createResponse = await createSession('Alice');
      const { session_id, session_password, participant_id: aliceId, auth_token: aliceAuthToken } = await createResponse.json() as {
        session_id: string;
        session_password: string;
        participant_id: string;
        auth_token: string;
      };

      const joinResponse = await joinSession(session_id, session_password, 'Bob');
      const { participant_id: bobId, auth_token: bobAuthToken } = await joinResponse.json() as {
        participant_id: string;
        auth_token: string;
      };

      // Bob tries to remove Alice without admin password
      const removeRequest = new Request(
        `http://localhost/api/sessions/${session_id}/participants/${aliceId}`,
        {
          method: 'DELETE',
          headers: { 'X-Session-Password': session_password, 'X-Auth-Token': bobAuthToken },
        }
      );
      const removeResponse = await worker.fetch(removeRequest, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(removeResponse.status).toBe(403);
      const data = await removeResponse.json() as { error: string };
      expect(data.error).toBe('ADMIN_REQUIRED');
    });

    it('should return 404 for non-existent participant', async () => {
      const createResponse = await createSession('Alice');
      const { session_id, session_password, admin_password, participant_id: aliceId, auth_token: aliceAuthToken } = await createResponse.json() as {
        session_id: string;
        session_password: string;
        admin_password: string;
        participant_id: string;
        auth_token: string;
      };

      const removeRequest = new Request(
        `http://localhost/api/sessions/${session_id}/participants/p_nonexistent`,
        {
          method: 'DELETE',
          headers: {
            'X-Session-Password': session_password,
            'X-Auth-Token': aliceAuthToken,
            'X-Admin-Password': admin_password,
          },
        }
      );
      const removeResponse = await worker.fetch(removeRequest, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(removeResponse.status).toBe(404);
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('should return session info', async () => {
      const createResponse = await createSession('Alice');
      const { session_id, session_password, participant_id, auth_token } = await createResponse.json() as {
        session_id: string;
        session_password: string;
        participant_id: string;
        auth_token: string;
      };

      // Send a message to have message_count > 0
      await sendMessage(session_id, session_password, auth_token, participant_id, 'Hello');

      const infoRequest = new Request(`http://localhost/api/sessions/${session_id}`, {
        method: 'GET',
        headers: { 'X-Session-Password': session_password },
      });
      const infoResponse = await worker.fetch(infoRequest, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(infoResponse.status).toBe(200);

      const data = await infoResponse.json() as {
        session_id: string;
        created_at: number;
        expires_at: number;
        participant_count: number;
        message_count: number;
        is_ended: boolean;
      };

      expect(data.session_id).toBe(session_id);
      expect(data.created_at).toBeGreaterThan(0);
      expect(data.expires_at).toBeGreaterThan(data.created_at);
      expect(data.participant_count).toBe(1);
      expect(data.message_count).toBe(1);
      expect(data.is_ended).toBe(false);
    });

    it('should reject without session password', async () => {
      const createResponse = await createSession('Alice');
      const { session_id } = await createResponse.json() as { session_id: string };

      const infoRequest = new Request(`http://localhost/api/sessions/${session_id}`, {
        method: 'GET',
      });
      const infoResponse = await worker.fetch(infoRequest, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(infoResponse.status).toBe(401);
    });
  });

  describe('Health Check', () => {
    it('should return OK', async () => {
      const request = new Request('http://localhost/health');
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json() as { status: string };
      expect(data.status).toBe('ok');
    });
  });
});
