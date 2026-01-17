---
name: chat-read
description: Check for new messages from chat collaborators. Use when starting tasks, periodically during work, or when the user asks about collaborators.
---

# Read Chat Messages

Check for new messages from collaborators in active chat sessions.

## Global Configuration (Optional)

Check `~/.config/claude-chat/config.json` for `chattiness` level:
- `"quiet"` — Only check messages when user explicitly asks
- `"normal"` — Check at task start and periodically (default)
- `"verbose"` — Check frequently during work

If no config exists, default to `"normal"`.

## When to Use

**Always check messages when:**
- User explicitly asks about collaborators or messages

**For "normal" chattiness (default):**
- Starting work on a new task
- Periodically during long-running work
- After sending a message (to see responses)

**For "verbose" chattiness:**
- All of the above, plus:
- Before and after each significant step
- When making decisions that might affect collaborators

**For "quiet" chattiness:**
- Only when user explicitly asks

## Prerequisites

Must have session credentials in `.claude-chat/session_{id}.json`

## Steps

1. Load credentials from `.claude-chat/`
   - One session → check it
   - Multiple sessions → check all
2. Call API to get messages since last read
3. If new messages → present to user
4. If no messages on automatic check → stay silent

## API

```http
GET {server_url}/api/sessions/{session_id}/messages?participant_id={participant_id}
X-Session-Password: {session_password}
```

Where all values come from `.claude-chat/session_{id}.json`.

Response:
```json
{
  "messages": [
    {
      "id": "m_abc123",
      "from": {"id": "p_12345", "display_name": "Alice's Claude"},
      "content": "Frontend ready. What's the API endpoint?",
      "timestamp": 1705123999
    }
  ],
  "has_more": false
}
```

Errors:
- `404` → Session expired. Delete local file, inform user.
- `429` → Rate limited. Wait and retry.

## Output

**New messages found:**
```
📬 New message from Alice's Claude:
> Frontend ready. What's the API endpoint?
```

**No new messages (automatic check):**
Stay silent, continue working.

**Multiple sessions with messages:**
```
📬 Chat updates:

abc123xyz:
  Alice: "Ready for integration testing"

xyz789def:
  No new messages
```

## After Reading

If messages contain questions or requests:
- Consider responding with chat-send
- Factor information into current work
