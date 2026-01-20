/**
 * Integration tests for Claude Chat API.
 *
 * Run against any environment:
 *   pnpm test:integration:local                                    # localhost
 *   STAGING_AUTH_TOKEN=xxx pnpm test:integration:staging           # staging (requires token)
 *   SERVER_URL=https://custom.workers.dev pnpm test:integration    # custom URL
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { MAX_MESSAGE_LIMIT, MAX_MESSAGES } from '@claude-chat/protocol';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8787';
const STAGING_AUTH_TOKEN = process.env.STAGING_AUTH_TOKEN;
const RUN_MESSAGE_LIMIT_TESTS = process.env.RUN_MESSAGE_LIMIT_TESTS === 'true';
const MAX_MESSAGES_ENV = Number.parseInt(process.env.MAX_MESSAGES ?? '', 10);
const MAX_MESSAGE_LENGTH_ENV = Number.parseInt(process.env.MAX_MESSAGE_LENGTH ?? '', 10);
const EFFECTIVE_MAX_MESSAGES =
  Number.isFinite(MAX_MESSAGES_ENV) && MAX_MESSAGES_ENV > 0 ? MAX_MESSAGES_ENV : MAX_MESSAGES;
const EFFECTIVE_MAX_MESSAGE_LENGTH =
  Number.isFinite(MAX_MESSAGE_LENGTH_ENV) && MAX_MESSAGE_LENGTH_ENV > 0
    ? MAX_MESSAGE_LENGTH_ENV
    : 50_000;

/**
 * Helper to add auth header when STAGING_AUTH_TOKEN is set.
 */
function authHeaders(): HeadersInit {
  if (STAGING_AUTH_TOKEN) {
    return { Authorization: `Bearer ${STAGING_AUTH_TOKEN}` };
  }
  return {};
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SessionCredentials {
  session_id: string;
  session_password: string;
  admin_password: string;
  participant_id: string;
  auth_token: string;
}

async function createSession(displayName: string): Promise<SessionCredentials> {
  const response = await fetch(`${SERVER_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ display_name: displayName }),
  });

  if (response.status !== 201) {
    throw new Error(`Expected session creation to return 201, got ${response.status}`);
  }

  return (await response.json()) as SessionCredentials;
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
            'X-Auth-Token': testSession.auth_token,
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
          headers: {
            'X-Session-Password': testSession.session_password,
            'X-Auth-Token': testSession.auth_token,
            ...authHeaders(),
          },
        }
      );

      expect(readResponse.status).toBe(200);

      const readData = (await readResponse.json()) as {
        messages: Array<{ id: string; content: string }>;
      };
      expect(readData.messages).toHaveLength(1);
      expect(readData.messages[0].content).toBe('Integration test message');
    });

    it('should reject messages without auth token', async () => {
      const response = await fetch(
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
            content: 'Missing auth token',
          }),
        }
      );

      expect(response.status).toBe(401);
    });

    it('should reject reads without auth token', async () => {
      const response = await fetch(
        `${SERVER_URL}/api/sessions/${testSession.session_id}/messages?participant_id=${testSession.participant_id}`,
        {
          headers: { 'X-Session-Password': testSession.session_password, ...authHeaders() },
        }
      );

      expect(response.status).toBe(401);
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
        auth_token: string;
        participants: Array<{ id: string }>;
      };
      expect(joinData.participant_id).toMatch(/^p_/);
      expect(joinData.participants).toHaveLength(2);

      // Leave session
      const leaveResponse = await fetch(
        `${SERVER_URL}/api/sessions/${testSession.session_id}/participants/${joinData.participant_id}`,
        {
          method: 'DELETE',
          headers: {
            'X-Session-Password': testSession.session_password,
            'X-Auth-Token': joinData.auth_token,
            ...authHeaders(),
          },
        }
      );

      expect(leaveResponse.status).toBe(200);
    });

    it('should reject message when auth token does not match participant', async () => {
      const joinResponse = await fetch(
        `${SERVER_URL}/api/sessions/${testSession.session_id}/join`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Password': testSession.session_password,
            ...authHeaders(),
          },
          body: JSON.stringify({ display_name: 'Token Mismatch' }),
        }
      );

      expect(joinResponse.status).toBe(200);
      const joinData = (await joinResponse.json()) as { participant_id: string; auth_token: string };

      const response = await fetch(
        `${SERVER_URL}/api/sessions/${testSession.session_id}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Password': testSession.session_password,
            'X-Auth-Token': testSession.auth_token,
            ...authHeaders(),
          },
          body: JSON.stringify({
            participant_id: joinData.participant_id,
            content: 'Wrong token for participant',
          }),
        }
      );

      expect(response.status).toBe(401);
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

    it('should enforce message length limits', async () => {
      const session = await createSession('Message Length Limits');

      const maxLengthContent = 'x'.repeat(EFFECTIVE_MAX_MESSAGE_LENGTH);
      const maxLengthResponse = await fetch(
        `${SERVER_URL}/api/sessions/${session.session_id}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Password': session.session_password,
            'X-Auth-Token': session.auth_token,
            ...authHeaders(),
          },
          body: JSON.stringify({
            participant_id: session.participant_id,
            content: maxLengthContent,
          }),
        }
      );
      expect(maxLengthResponse.status).toBe(201);

      const tooLongContent = 'x'.repeat(EFFECTIVE_MAX_MESSAGE_LENGTH + 1);
      const tooLongResponse = await fetch(
        `${SERVER_URL}/api/sessions/${session.session_id}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Password': session.session_password,
            'X-Auth-Token': session.auth_token,
            ...authHeaders(),
          },
          body: JSON.stringify({
            participant_id: session.participant_id,
            content: tooLongContent,
          }),
        }
      );
      expect(tooLongResponse.status).toBe(400);

      await fetch(`${SERVER_URL}/api/sessions/${session.session_id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': session.admin_password, ...authHeaders() },
      });
    });

    it.skipIf(!RUN_MESSAGE_LIMIT_TESTS)(
      'should retain only the latest messages when exceeding the limit',
      async () => {
        const session = await createSession('Message Window');

        const joinResponseA = await fetch(`${SERVER_URL}/api/sessions/${session.session_id}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Password': session.session_password,
            ...authHeaders(),
          },
          body: JSON.stringify({ display_name: 'Sender A' }),
        });
        const participantA = (await joinResponseA.json()) as {
          participant_id: string;
          auth_token: string;
        };

        const joinResponseB = await fetch(`${SERVER_URL}/api/sessions/${session.session_id}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Password': session.session_password,
            ...authHeaders(),
          },
          body: JSON.stringify({ display_name: 'Sender B' }),
        });
        const participantB = (await joinResponseB.json()) as {
          participant_id: string;
          auth_token: string;
        };

        const participants = [
          {
            id: session.participant_id,
            token: session.auth_token,
          },
          {
            id: participantA.participant_id,
            token: participantA.auth_token,
          },
          {
            id: participantB.participant_id,
            token: participantB.auth_token,
          },
        ];

        const totalMessages = EFFECTIVE_MAX_MESSAGES + 5;
        const sentMessageIds: string[] = [];

        for (let i = 0; i < totalMessages; i += 1) {
          const participant = participants[i % participants.length];
          const sendResponse = await fetch(
            `${SERVER_URL}/api/sessions/${session.session_id}/messages`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Session-Password': session.session_password,
                'X-Auth-Token': participant.token,
                ...authHeaders(),
              },
              body: JSON.stringify({
                participant_id: participant.id,
                content: `message-${i}`,
              }),
            }
          );

          if (sendResponse.status === 429) {
            await sleep(61_000);
            i -= 1;
            continue;
          }

          expect(sendResponse.status).toBe(201);
          const sendData = (await sendResponse.json()) as { message_id: string };
          sentMessageIds.push(sendData.message_id);
        }

        const infoResponse = await fetch(`${SERVER_URL}/api/sessions/${session.session_id}`, {
          headers: { 'X-Session-Password': session.session_password, ...authHeaders() },
        });
        const infoData = (await infoResponse.json()) as { message_count: number };
        expect(infoData.message_count).toBe(EFFECTIVE_MAX_MESSAGES);

        const readResponse = await fetch(
          `${SERVER_URL}/api/sessions/${session.session_id}/messages?participant_id=${session.participant_id}&limit=${Math.min(MAX_MESSAGE_LIMIT, EFFECTIVE_MAX_MESSAGES)}`,
          {
            headers: {
              'X-Session-Password': session.session_password,
              'X-Auth-Token': session.auth_token,
              ...authHeaders(),
            },
          }
        );
        expect(readResponse.status).toBe(200);
        const readData = (await readResponse.json()) as {
          messages: Array<{ id: string }>;
        };
        expect(readData.messages).toHaveLength(EFFECTIVE_MAX_MESSAGES);
        expect(readData.messages[0].id).toBe(sentMessageIds[totalMessages - EFFECTIVE_MAX_MESSAGES]);

        await fetch(`${SERVER_URL}/api/sessions/${session.session_id}`, {
          method: 'DELETE',
          headers: { 'X-Admin-Password': session.admin_password, ...authHeaders() },
        });
      }
    );
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
        `${SERVER_URL}/api/sessions/${session.session_id}/participants/${joinData.participant_id}`,
        {
          method: 'DELETE',
          headers: {
            'X-Session-Password': session.session_password,
            'X-Auth-Token': session.auth_token,
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

    it('should reject admin kick with invalid auth token', async () => {
      const createResponse = await fetch(`${SERVER_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ display_name: 'Admin Invalid Token' }),
      });
      const session = (await createResponse.json()) as SessionCredentials;

      const joinResponse = await fetch(`${SERVER_URL}/api/sessions/${session.session_id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Password': session.session_password,
          ...authHeaders(),
        },
        body: JSON.stringify({ display_name: 'Target' }),
      });
      const joinData = (await joinResponse.json()) as { participant_id: string };

      const kickResponse = await fetch(
        `${SERVER_URL}/api/sessions/${session.session_id}/participants/${joinData.participant_id}`,
        {
          method: 'DELETE',
          headers: {
            'X-Session-Password': session.session_password,
            'X-Auth-Token': 'invalid-token',
            'X-Admin-Password': session.admin_password,
            ...authHeaders(),
          },
        }
      );

      expect(kickResponse.status).toBe(401);

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
