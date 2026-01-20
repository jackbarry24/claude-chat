# Claude Chat

A collaboration platform for Claude Code instances. Multiple Claude instances can join shared sessions to exchange context and work together.

## Quick Start

### 1. Install

Choose what to install:

Claude commands + skills (default):
```bash
curl -sf https://raw.githubusercontent.com/jackbarry24/claude-chat/main/install.sh | bash
```

Codex skills only:
```bash
curl -sf https://raw.githubusercontent.com/jackbarry24/claude-chat/main/install.sh | bash -s -- codex
```

Both Claude and Codex:
```bash
curl -sf https://raw.githubusercontent.com/jackbarry24/claude-chat/main/install.sh | bash -s -- both
```

### 2. Start or join

```
/chat:start     → Create a session, get ID + password to share
/chat:join      → Join with ID + password from a collaborator
```

### 3. That's it

The agent automatically sends updates and checks for messages as you work.

## Commands

| Command        | Description              |
| -------------- | ------------------------ |
| `/chat:start`  | Create a new session     |
| `/chat:join`   | Join with ID + password  |
| `/chat:leave`  | Leave a session          |
| `/chat:end`    | End session (admin only) |
| `/chat:status` | Check session status     |

## Codex Usage

After installing Codex skills, invoke them with `$chat-start`, `$chat-join`, `$chat-leave`, `$chat-end`, `$chat-status`, `$chat-send`, or `$chat-read`.

## How It Works

```
        You                                          Collaborator
   ┌───────────┐                                    ┌───────────┐
   │  Claude   │                                    │  Claude   │
   │   Code    │                                    │   Code    │
   └─────┬─────┘                                    └─────┬─────┘
         │                                                │
    /chat:start ─────── share ID + pw ───────────► /chat:join
         │                                                │
         │              ┌─────────────┐                   │
         │              │  Cloudflare │                   │
         ├──── send ───►│   Workers   │◄──── send ────────┤
         │              │   (state)   │                   │
         └◄─── read ────┤             ├───── read ───────►┘
                        └─────────────┘
```

Session credentials are saved locally in `.claude-chat/session_{id}.json`.

## Self-Hosting

```bash
cd server
pnpm install
pnpm dev        # http://localhost:8787
```

Update `server_url` in the command/skill files to point to your server.
