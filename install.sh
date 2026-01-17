#!/usr/bin/env bash
#
# Claude Chat installer
# Usage: curl -sf https://raw.githubusercontent.com/jackbarry24/claude-chat/main/install.sh | bash
#

set -e

REPO="https://raw.githubusercontent.com/jackbarry24/claude-chat/main"
MARKER="## Chat Collaboration"

echo "Installing Claude Chat..."

# Commands
mkdir -p .claude/commands/chat
curl -sf "$REPO/claude/commands/chat/start.md" -o .claude/commands/chat/start.md
curl -sf "$REPO/claude/commands/chat/join.md" -o .claude/commands/chat/join.md
curl -sf "$REPO/claude/commands/chat/leave.md" -o .claude/commands/chat/leave.md
curl -sf "$REPO/claude/commands/chat/end.md" -o .claude/commands/chat/end.md
curl -sf "$REPO/claude/commands/chat/status.md" -o .claude/commands/chat/status.md

# Skills
mkdir -p .claude/skills/chat-send .claude/skills/chat-read
curl -sf "$REPO/claude/skills/chat-send/SKILL.md" -o .claude/skills/chat-send/SKILL.md
curl -sf "$REPO/claude/skills/chat-read/SKILL.md" -o .claude/skills/chat-read/SKILL.md

# Add instructions to CLAUDE.md (if not already present)
CLAUDE_MD=".claude/CLAUDE.md"
if [ -f "$CLAUDE_MD" ] && grep -q "$MARKER" "$CLAUDE_MD"; then
  echo "CLAUDE.md already has chat instructions, skipping..."
else
  echo "" >> "$CLAUDE_MD"
  cat >> "$CLAUDE_MD" << 'INSTRUCTIONS'
## Chat Collaboration

If a `.claude-chat/` directory exists with session files, you are in an active collaboration session with other Claude instances. Before starting any task:

1. **Check for messages** using the chat-read skill
2. **Action any requests** from collaborators before proceeding
3. **Send updates** when you complete significant work or have questions

This enables real-time collaboration between multiple Claude Code instances working on the same or related tasks.
INSTRUCTIONS
  echo "Added chat instructions to CLAUDE.md"
fi

echo ""
echo "Done! Claude Chat installed to .claude/"
echo ""
echo "Commands:"
echo "  /chat/start  - Create a new session"
echo "  /chat/join   - Join with ID + password"
echo "  /chat/leave  - Leave a session"
echo "  /chat/end    - End session (admin)"
echo "  /chat/status - Check session status"
