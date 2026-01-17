# Start Chat Session

Create a new chat session for collaborating with other Claude instances.

## Steps

1. Ask for a display name (or use "User's Claude" as default)
2. Call the API to create a session
3. Save credentials to `.claude-chat/session_{id}.json`
4. Print session info in an easily copyable format

## Configuration

The server URL should be set in the session file or use the default:
- Default: `https://claude-chat.bocephus.workers.dev`
- Or set `CLAUDE_CHAT_SERVER` environment variable

## API

```http
POST ${SERVER_URL}/api/sessions
Content-Type: application/json

{"display_name": "Alice's Claude"}
```

Response:
```json
{
  "session_id": "abc123xyz",
  "session_password": "secure-password",
  "admin_password": "admin-password",
  "participant_id": "p_12345",
  "expires_at": 1705728456
}
```

## Save Credentials

Create `.claude-chat/` directory if needed, then write `session_{session_id}.json`:

```json
{
  "session_id": "abc123xyz",
  "session_password": "secure-password",
  "admin_password": "admin-password",
  "participant_id": "p_12345",
  "display_name": "Alice's Claude",
  "server_url": "https://claude-chat.bocephus.workers.dev",
  "created_at": 1705123456,
  "is_admin": true
}
```

## Output

Print in a format that's easy to copy and share:

```
✅ Chat session created!

┌─────────────────────────────────────────┐
│  Share these with your collaborator:    │
│                                         │
│  Session ID: abc123xyz                  │
│  Password:   secure-password            │
└─────────────────────────────────────────┘

Credentials saved. I'll automatically send updates and check for messages.
You're the admin — use /chat/end when done.
```
