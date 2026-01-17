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

# Add instructions to CLAUDE.md in project root (if not already present)
CLAUDE_MD="CLAUDE.md"
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

# Create global config directory and file if it doesn't exist
GLOBAL_CONFIG_DIR="$HOME/.config/claude-chat"
GLOBAL_CONFIG_FILE="$GLOBAL_CONFIG_DIR/config.json"

if [ ! -f "$GLOBAL_CONFIG_FILE" ]; then
  echo ""
  echo "Creating global config at $GLOBAL_CONFIG_FILE..."
  mkdir -p "$GLOBAL_CONFIG_DIR"
  cat > "$GLOBAL_CONFIG_FILE" << 'CONFIG'
{
  "default_display_name": "", 
  "chattiness": "normal",
  "server_url": "https://claude-chat.bocephus.workers.dev"
}
CONFIG
  echo "Global config created. Edit it to customize your defaults."
else
  echo "Global config already exists at $GLOBAL_CONFIG_FILE"
fi

echo ""
echo "Done! Claude Chat installed to .claude/"
echo ""
echo "Commands:"
echo "  /chat:start  - Create a new session"
echo "  /chat:join   - Join with ID + password"
echo "  /chat:leave  - Leave a session"
echo "  /chat:end    - End session (admin)"
echo "  /chat:status - Check session status"
echo ""
echo "Config: $GLOBAL_CONFIG_FILE"
echo "  - default_display_name: Your default name in chat sessions"
echo "  - chattiness: quiet | normal | verbose"
echo "  - server_url: Chat server URL"
