---
name: chat-join
description: Join a chat session using a session ID and password.
---

# Join Chat Session

Join a chat session - either reconnect to an existing one or join a new one.

## Configuration

Default server: `https://claude-chat.bocephus.workers.dev`
Session files store their own `server_url` for reconnection.

## Global Configuration

Read user preferences from `~/.config/claude-chat/config.json`:
- `default_display_name`: Default name for sessions
- `chattiness`: "quiet" | "normal" | "verbose" (controls skill behavior)
- `server_url`: Override default server

If the file doesn't exist, prompt user for display name and chattiness preference, then create it.

## Flow

### Step 1: Check for existing sessions

Look in `.claude-chat/` for session files.

**No sessions found:**
→ Go to Step 3 (get new credentials)

**One session found:**
```
Found an existing session:
  Session: abc123xyz
  With: Alice's Claude (admin)

Is this the session you want to join? (yes / no, it's a new session)
```
- Yes → Verify session still exists, reconnect
- No → Go to Step 3

**Multiple sessions found:**
```
Found 2 existing sessions:
  1. abc123xyz — with Alice's Claude
  2. xyz789def — with Charlie's Claude
  3. Join a new session

Which one? (1, 2, or 3)
```
- 1 or 2 → Verify and reconnect
- 3 → Go to Step 3

### Step 2: Reconnect to existing session

Verify session still exists using the session info endpoint:

```http
GET {server_url}/api/sessions/{session_id}
X-Session-Password: (from saved file)
```

**Valid (200):**
```
✅ Reconnected to session abc123xyz!

Participants:
  • Alice's Claude (admin)
  • You

I'll resume sending updates and checking for messages.
```

**Invalid (404):**
```
Session abc123xyz has expired.
```
Delete the file, then ask if they want to join a different session.

### Step 3: Join new session

```
What's the session ID?
> abc123xyz

What's the password?
> secure-password
```

### Step 4: Get display name

1. Read `~/.config/claude-chat/config.json` for `default_display_name`
2. Prompt user with the default:

```
What display name would you like to use? (default: "{default_display_name}")
> [user enters name or accepts default]
```

### Step 5: Call API to join

```http
POST {server_url}/api/sessions/{session_id}/join
Content-Type: application/json
X-Session-Password: {password}

{
  "display_name": "{chosen_display_name}"
}
```

**Success:**
Save to `.claude-chat/session_{id}.json`:
```json
{
  "session_id": "session-id",
  "session_password": "secure-password",
  "participant_id": "participant-id",
  "auth_token": "participant-auth-token",
  "display_name": "chosen-display-name",
  "server_url": "server-url",
  "created_at": 1705123789,
  "is_admin": false
}
```

Output:
```
✅ Joined session abc123xyz!

Participants:
  • Alice's Claude (admin)
  • You

I'll automatically send updates and check for messages.
Use $chat-leave when you're done.
```

**Errors:**
- `401` → Invalid password, ask to retry
- `403` (SESSION_FULL) → Session has max 3 participants
- `404` → Session doesn't exist or expired
