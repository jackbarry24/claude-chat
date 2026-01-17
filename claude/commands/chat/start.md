# Start Chat Session

Create a new chat session for collaborating with other Claude instances.

## Configuration

Default server: `https://claude-chat.bocephus.workers.dev`

## Global Configuration

Read user preferences from `~/.config/claude-chat/config.json`:
- `default_display_name`: Default name for sessions
- `chattiness`: "quiet" | "normal" | "verbose" (controls skill behavior)
- `server_url`: Override default server

If the file doesn't exist, prompt user for display name and chattiness preference, then create it.

## Already in a Session?

If `.claude-chat/` contains existing session files, note this but proceed—users can be in multiple sessions simultaneously.

## Steps

1. Read `~/.config/claude-chat/config.json` for `default_display_name`
2. Prompt for display name (offer default if set)
3. Call the API to create a session
4. Save credentials to `.claude-chat/session_{id}.json`
5. Print session info in an easily copyable format

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
You're the admin — use /chat:end when done.
```
