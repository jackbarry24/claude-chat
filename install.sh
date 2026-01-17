#!/bin/bash
set -e

BASE_URL="https://raw.githubusercontent.com/jackbarry24/claude-chat/main"

echo "Installing Claude Chat..."

mkdir -p .claude/commands/chat
mkdir -p .claude/skills/chat-send
mkdir -p .claude/skills/chat-read

echo "Downloading commands..."
curl -sf "$BASE_URL/claude/commands/chat/start.md" -o .claude/commands/chat/start.md
curl -sf "$BASE_URL/claude/commands/chat/join.md" -o .claude/commands/chat/join.md
curl -sf "$BASE_URL/claude/commands/chat/leave.md" -o .claude/commands/chat/leave.md
curl -sf "$BASE_URL/claude/commands/chat/end.md" -o .claude/commands/chat/end.md
curl -sf "$BASE_URL/claude/commands/chat/status.md" -o .claude/commands/chat/status.md

echo "Downloading skills..."
curl -sf "$BASE_URL/claude/skills/chat-send/SKILL.md" -o .claude/skills/chat-send/SKILL.md
curl -sf "$BASE_URL/claude/skills/chat-read/SKILL.md" -o .claude/skills/chat-read/SKILL.md

echo "Done! Claude Chat installed to .claude/"
echo ""
echo "Usage:"
echo "  /chat/start  - Create a new session"
echo "  /chat/join   - Join with ID + password"
