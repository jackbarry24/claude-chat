/**
 * Integration tests for Claude Chat API.
 *
 * Run against any environment:
 *   pnpm test:integration:local                                    # localhost
 *   STAGING_AUTH_TOKEN=xxx pnpm test:integration:staging           # staging (requires token)
 *   SERVER_URL=https://custom.workers.dev pnpm test:integration    # custom URL
 */
import { describe, it, expect, beforeAll } from 'vitest';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8787';
const STAGING_AUTH_TOKEN = process.env.STAGING_AUTH_TOKEN;

/**
 * Helper to add auth header when STAGING_AUTH_TOKEN is set.
 */
function authHeaders(): HeadersInit {
  if (STAGING_AUTH_TOKEN) {
    return { Authorization: `Bearer ${STAGING_AUTH_TOKEN}` };
  }
  return {};
}

interface SessionCredentials {
  session_id: string;
  session_password: string;
  admin_password: string;
  participant_id: string;
}

describe(`Integration Tests (${SERVER_URL})`, () => {
  let testSession: SessionCredentials;

  beforeAll(() => {
    console.log(`Running integration tests against: ${SERVER_URL}`);
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${SERVER_URL}/health`);
      expect(response.status).toBe(200);

      const data = (await response.json()) as { status: string };
      expect(data.status).toBe('ok');
    });
  });

  describe('Session Lifecycle', () => {
    it('should create a session', async () => {
      const response = await fetch(`${SERVER_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ display_name: 'Integration Test' }),
      });

      expect(response.status).toBe(201);

      const data = (await response.json()) as SessionCredentials & {
        created_at: number;
        expires_at: number;
      };

      expect(data.session_id).toBeTruthy();
      expect(data.session_password).toBeTruthy();
      expect(data.admin_password).toBeTruthy();
      expect(data.participant_id).toMatch(/^p_/);
      expect(data.created_at).toBeGreaterThan(0);
      expect(data.expires_at).toBeGreaterThan(data.created_at);

      testSession = data;
    });

    it('should get session info', async () => {
      const response = await fetch(`${SERVER_URL}/api/sessions/${testSession.session_id}`, {
        headers: { 'X-Session-Password': testSession.session_password, ...authHeaders() },
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        session_id: string;
        participant_count: number;
        message_count: number;
        is_ended: boolean;
      };

      expect(data.session_id).toBe(testSession.session_id);
      expect(data.participant_count).toBe(1);
      expect(data.message_count).toBe(0);
      expect(data.is_ended).toBe(false);
    });

    it('should send and receive messages', async () => {
      // Send a message
      const sendResponse = await fetch(
        `${SERVER_URL}/api/sessions/${testSession.session_id}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Password': testSession.session_password,
            ...authHeaders(),
          },
          body: JSON.stringify({
            participant_id: testSession.participant_id,
            content: 'Integration test message',
          }),
        }
      );

      expect(sendResponse.status).toBe(201);

      const sendData = (await sendResponse.json()) as {
        success: boolean;
        message_id: string;
      };
      expect(sendData.success).toBe(true);
      expect(sendData.message_id).toMatch(/^m_/);

      // Read messages
      const readResponse = await fetch(
        `${SERVER_URL}/api/sessions/${testSession.session_id}/messages?participant_id=${testSession.participant_id}`,
        {
          headers: { 'X-Session-Password': testSession.session_password, ...authHeaders() },
        }
      );

      expect(readResponse.status).toBe(200);

      const readData = (await readResponse.json()) as {
        messages: Array<{ id: string; content: string }>;
      };
      expect(readData.messages).toHaveLength(1);
      expect(readData.messages[0].content).toBe('Integration test message');
    });

    it('should allow joining and leaving', async () => {
      // Join session
      const joinResponse = await fetch(
        `${SERVER_URL}/api/sessions/${testSession.session_id}/join`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Password': testSession.session_password,
            ...authHeaders(),
          },
          body: JSON.stringify({ display_name: 'Second Participant' }),
        }
      );

      expect(joinResponse.status).toBe(200);

      const joinData = (await joinResponse.json()) as {
        participant_id: string;
        participants: Array<{ id: string }>;
      };
      expect(joinData.participant_id).toMatch(/^p_/);
      expect(joinData.participants).toHaveLength(2);

      // Leave session
      const leaveResponse = await fetch(
        `${SERVER_URL}/api/sessions/${testSession.session_id}/participants/${joinData.participant_id}?requester_id=${joinData.participant_id}`,
        {
          method: 'DELETE',
          headers: { 'X-Session-Password': testSession.session_password, ...authHeaders() },
        }
      );

      expect(leaveResponse.status).toBe(200);
    });

    it('should end session with admin password', async () => {
      const response = await fetch(`${SERVER_URL}/api/sessions/${testSession.session_id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': testSession.admin_password, ...authHeaders() },
      });

      expect(response.status).toBe(200);

      // Verify session is gone
      const checkResponse = await fetch(
        `${SERVER_URL}/api/sessions/${testSession.session_id}`,
        {
          headers: { 'X-Session-Password': testSession.session_password, ...authHeaders() },
        }
      );
      expect(checkResponse.status).toBe(404);
    });
  });

  describe('Session Limits', () => {
    it('should reject when session is full (max 3 participants)', async () => {
      // Create session (participant 1)
      const createResponse = await fetch(`${SERVER_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ display_name: 'Admin' }),
      });
      const session = (await createResponse.json()) as SessionCredentials;

      // Join as participant 2
      await fetch(`${SERVER_URL}/api/sessions/${session.session_id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Password': session.session_password,
          ...authHeaders(),
        },
        body: JSON.stringify({ display_name: 'Participant 2' }),
      });

      // Join as participant 3
      await fetch(`${SERVER_URL}/api/sessions/${session.session_id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Password': session.session_password,
          ...authHeaders(),
        },
        body: JSON.stringify({ display_name: 'Participant 3' }),
      });

      // Try to join as participant 4 (should fail)
      const fullResponse = await fetch(`${SERVER_URL}/api/sessions/${session.session_id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Password': session.session_password,
          ...authHeaders(),
        },
        body: JSON.stringify({ display_name: 'Participant 4' }),
      });

      expect(fullResponse.status).toBe(403);
      const data = (await fullResponse.json()) as { error: string };
      expect(data.error).toBe('SESSION_FULL');

      // Cleanup
      await fetch(`${SERVER_URL}/api/sessions/${session.session_id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': session.admin_password, ...authHeaders() },
      });
    });

    it('should reject oversized request body', async () => {
      // Create a body larger than 100KB
      const largeContent = 'x'.repeat(150 * 1024);

      const response = await fetch(`${SERVER_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ display_name: largeContent }),
      });

      expect(response.status).toBe(413);
    });
  });

  describe('Admin Operations', () => {
    it('should allow admin to kick another participant', async () => {
      // Create session
      const createResponse = await fetch(`${SERVER_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ display_name: 'Admin' }),
      });
      const session = (await createResponse.json()) as SessionCredentials;

      // Join as second participant
      const joinResponse = await fetch(`${SERVER_URL}/api/sessions/${session.session_id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Password': session.session_password,
          ...authHeaders(),
        },
        body: JSON.stringify({ display_name: 'To Be Kicked' }),
      });
      const joinData = (await joinResponse.json()) as { participant_id: string };

      // Admin kicks the second participant
      const kickResponse = await fetch(
        `${SERVER_URL}/api/sessions/${session.session_id}/participants/${joinData.participant_id}?requester_id=${session.participant_id}`,
        {
          method: 'DELETE',
          headers: {
            'X-Session-Password': session.session_password,
            'X-Admin-Password': session.admin_password,
            ...authHeaders(),
          },
        }
      );

      expect(kickResponse.status).toBe(200);
      const kickData = (await kickResponse.json()) as { success: boolean };
      expect(kickData.success).toBe(true);

      // Verify participant count is now 1
      const infoResponse = await fetch(`${SERVER_URL}/api/sessions/${session.session_id}`, {
        headers: { 'X-Session-Password': session.session_password, ...authHeaders() },
      });
      const infoData = (await infoResponse.json()) as { participant_count: number };
      expect(infoData.participant_count).toBe(1);

      // Cleanup
      await fetch(`${SERVER_URL}/api/sessions/${session.session_id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': session.admin_password, ...authHeaders() },
      });
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid session password', async () => {
      // Create a fresh session for this test
      const createResponse = await fetch(`${SERVER_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ display_name: 'Error Test' }),
      });
      const session = (await createResponse.json()) as SessionCredentials;

      const response = await fetch(`${SERVER_URL}/api/sessions/${session.session_id}`, {
        headers: { 'X-Session-Password': 'wrong-password', ...authHeaders() },
      });

      expect(response.status).toBe(401);

      // Cleanup
      await fetch(`${SERVER_URL}/api/sessions/${session.session_id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': session.admin_password, ...authHeaders() },
      });
    });

    it('should return 404 for non-existent session', async () => {
      const response = await fetch(`${SERVER_URL}/api/sessions/nonexistent`, {
        headers: { 'X-Session-Password': 'any', ...authHeaders() },
      });

      expect(response.status).toBe(404);
    });

    it('should validate request body', async () => {
      const response = await fetch(`${SERVER_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });

  // Staging auth tests - only run when testing against staging with a token
  describe('Staging Authentication', () => {
    const isStaging = SERVER_URL.includes('staging') && STAGING_AUTH_TOKEN;

    it.skipIf(!isStaging)('should reject requests without auth token', async () => {
      // Make request WITHOUT auth header
      const response = await fetch(`${SERVER_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // No auth header
        body: JSON.stringify({ display_name: 'No Auth Test' }),
      });

      expect(response.status).toBe(401);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it.skipIf(!isStaging)('should allow health endpoint without auth', async () => {
      // Health should work without auth even on staging
      const response = await fetch(`${SERVER_URL}/health`);
      expect(response.status).toBe(200);
    });
  });
});
