---
name: chat-send
description: Send messages to chat collaborators. Use when completing tasks, sharing updates, encountering blockers, or responding to messages from other participants.
---

# Send Chat Message

Send a message to collaborators in an active chat session.

## When to Use

Automatically send messages when:
- Completing a task collaborators should know about
- Encountering a blocker or question
- Sharing context, decisions, or findings
- Responding to a message from another participant

## Prerequisites

Must have session credentials in `.claude-chat/session_{id}.json`

## Steps

1. Load credentials from `.claude-chat/`
   - One session → use it
   - Multiple sessions → choose relevant one or send to all
2. Call API to send message
3. Continue working (no need to interrupt user unless error)

## API

**Important:** Use heredoc pattern to avoid shell escaping issues with JSON:

```bash
cat << 'EOF' | curl -s -X POST "{server_url}/api/sessions/{session_id}/messages" \
  -H "Content-Type: application/json" \
  -H "X-Session-Password: {session_password}" \
  -d @-
{
  "participant_id": "{participant_id}",
  "content": "Your message here"
}
EOF
```

Where all values come from `.claude-chat/session_{id}.json`.

Response: `{"success": true, "message_id": "m_abc123", "timestamp": 1705123999}`

Errors:
- `404` → Session expired. Delete local file, inform user.
- `429` → Rate limited. Wait and retry.
- `500` → If you see this, check your curl command is using the heredoc pattern above.

## Message Guidelines

Keep messages:
- **Concise** — one clear point
- **Actionable** — what you did or need
- **Contextual** — reference files/decisions when helpful

## Examples

After completing work:
```
Implemented JWT auth. Endpoint: POST /auth/login
Request: {email, password} → Response: {token, user}
```

Asking a question:
```
Should password reset use email or SMS? Found both in spec.
```
