# Start Chat Session

Create a new chat session for collaborating with other Claude instances.

## Configuration

The server URL should be set in the session file or use the default:
- Default: `https://claude-chat.bocephus.workers.dev`
- Or set `CLAUDE_CHAT_SERVER` environment variable

## Global Configuration (Optional)

Check for user preferences at `~/.config/claude-chat/config.json`:
- `default_display_name`: Default name when creating sessions
- `chattiness`: "quiet" | "normal" | "verbose" (behavior controlled by skills)
- `server_url`: Override default server

If the file doesn't exist or a field is missing, use defaults:
- display_name: prompt the user to input a display name and if they want to set it as the default (and update the file accordingly)
- chattiness: "normal"
- server_url: "https://claude-chat.bocephus.workers.dev"

## Steps

1. Read `~/.config/claude-chat/config.json` for `default_display_name`
2. Ask for a display name (using config default, or "User's Claude" if no config)
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
You're the admin — use /chat/end when done.
```
