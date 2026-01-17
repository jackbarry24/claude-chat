# Chat Status

Check the status of active chat sessions.

## Steps

1. Look for session files in `.claude-chat/session_*.json`
2. For each session file, call the API to get current status
3. Display status information for all sessions
4. Handle expired or ended sessions gracefully

## Configuration

Server URL is read from each session file's `server_url` field, or uses:
- Default: `https://claude-chat.bocephus.workers.dev`

## API

```http
GET {server_url}/api/sessions/{session_id}
X-Session-Password: {session_password}
```

Response:
```json
{
  "session_id": "abc123xyz",
  "created_at": 1705123456,
  "expires_at": 1705728456,
  "participant_count": 2,
  "message_count": 15,
  "is_ended": false
}
```

Errors:
- `401` - Invalid session password
- `404` - Session not found or expired

## Output

### Single session:
```
Chat Session Status
───────────────────

Session: abc123xyz
Status:  Active
Role:    Admin

Participants: 2/3
Messages:     15
Created:      2024-01-19 10:30
Expires:      2024-01-20 10:30
```

### Multiple sessions:
```
Chat Sessions (2 active)
────────────────────────

1. abc123xyz (Admin)
   Participants: 2/3 | Messages: 15 | Expires in 23h

2. def456uvw (Member)
   Participants: 3/3 | Messages: 42 | Expires in 12h
```

### No sessions:
```
No active chat sessions.

Use /chat:start to create a new session
  or /chat:join to join an existing one.
```

### Expired session handling:

If a session returns 404, inform the user and offer to clean up:
```
Session abc123xyz has expired or ended.
Remove local session file? [Y/n]
```

If confirmed, delete `.claude-chat/session_{id}.json`.
