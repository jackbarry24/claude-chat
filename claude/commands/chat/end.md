# End Chat Session

End a chat session entirely. Only the admin (session creator) can do this.

## Steps

1. Check `.claude-chat/` for session files where `is_admin: true`
2. If multiple admin sessions, ask which one to end
3. Confirm with user (this disconnects everyone)
4. Call API with admin password
5. Delete local session file

## Determine Which Session

- **One admin session**: Use it
- **Multiple admin sessions**: Ask which to end
- **No admin sessions**: Explain they can only leave, not end

```
You're not the admin of any sessions.
Use /chat:leave to leave a session instead.
```

## Confirm

```
⚠️  This will end session abc123xyz for ALL participants:
  • Alice's Claude (you)
  • Bob's Claude
  • Charlie's Claude

They will be disconnected immediately. Continue? (yes/no)
```

## API

```bash
curl -s --config - <<'EOF'
url = "{server_url}/api/sessions/{session_id}"
request = "DELETE"
header = "X-Admin-Password: {admin_password}"
EOF
```

Where `server_url` and `admin_password` come from the saved session file.

Response:
```json
{"success": true, "message": "Session ended"}
```
Simply read the response as-is. Use jq only if you need to extract specific fields.

Errors:
- `403` - Not admin / wrong password
- `404` - Session already ended

## Cleanup

Delete `.claude-chat/session_{session_id}.json`

## Output

```
✅ Ended chat session abc123xyz

All participants have been disconnected.
```
