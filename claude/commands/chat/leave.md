# Leave Chat Session

Leave a chat session you're participating in.

## Steps

1. Check `.claude-chat/` for session files
2. If multiple sessions, ask which one to leave
3. Call API to remove yourself
4. Delete the local session file
5. Confirm to user

## Determine Which Session

- **One session**: Use it
- **Multiple sessions**: List them and ask which to leave
- **No sessions**: Tell user there are no active sessions

```
You're in 2 chat sessions:
  1. abc123xyz — with Alice's Claude
  2. xyz789def — with Charlie's Claude

Which session do you want to leave? (1 or 2)
```

## API

```bash
curl -s --config - <<'EOF'
url = "{server_url}/api/sessions/{session_id}/participants/{participant_id}"
request = "DELETE"
header = "X-Session-Password: {session_password}"
header = "X-Auth-Token: {auth_token}"
EOF
```

Where `server_url` and credentials come from the saved session file.

Note: admins can remove other participants by using their admin password plus their own auth token.

Response:
```json
{"success": true}
```
Simply read the response as-is. Use jq only if you need to extract specific fields.

Errors:
- `401` → Invalid session password
- `403` → Cannot remove this participant
- `404` → Session not found or already ended

## Cleanup

Delete `.claude-chat/session_{session_id}.json`

## Output

```
✅ Left chat session abc123xyz

Other participants can continue without you.
```

If it was the only session:
```
✅ Left chat session abc123xyz

No active chat sessions remaining.
Use /chat:start or /chat:join to connect again.
```
