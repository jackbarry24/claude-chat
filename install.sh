#!/usr/bin/env bash
#
# Claude Chat installer
# Usage: curl -sf https://raw.githubusercontent.com/jackbarry24/claude-chat/main/install.sh | bash
#

set -e

REPO="https://raw.githubusercontent.com/jackbarry24/claude-chat/main"
MARKER="## Chat Collaboration"

echo "Installing Claude Chat..."

INSTALL_TARGET="${1:-}"
if [ -z "$INSTALL_TARGET" ]; then
  if [ -t 0 ]; then
    echo ""
    echo "Install for which tool? (claude/codex/both) [claude]"
    read -r INSTALL_TARGET
    INSTALL_TARGET="${INSTALL_TARGET:-claude}"
  else
    INSTALL_TARGET="claude"
  fi
fi

INSTALL_TARGET="$(echo "$INSTALL_TARGET" | tr '[:upper:]' '[:lower:]')"
case "$INSTALL_TARGET" in
  claude|codex|both)
    ;;
  *)
    echo "Unknown install target: $INSTALL_TARGET"
    echo "Use one of: claude, codex, both"
    exit 1
    ;;
esac

install_claude() {
  echo "Installing Claude commands and skills..."

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
}

install_codex() {
  echo "Installing Codex skills..."

  mkdir -p .codex/skills
  for skill in chat-start chat-join chat-leave chat-end chat-status chat-send chat-read; do
    mkdir -p ".codex/skills/$skill"
    curl -sf "$REPO/codex/skills/$skill/SKILL.md" -o ".codex/skills/$skill/SKILL.md"
  done

  # Add instructions to AGENTS.md in project root (if not already present)
  AGENTS_MD="AGENTS.md"
  if [ -f "$AGENTS_MD" ] && grep -q "$MARKER" "$AGENTS_MD"; then
    echo "AGENTS.md already has chat instructions, skipping..."
  else
    if [ ! -f "$AGENTS_MD" ]; then
      cat > "$AGENTS_MD" << 'HEADER'
# AGENTS
HEADER
    fi
    echo "" >> "$AGENTS_MD"
    cat >> "$AGENTS_MD" << 'INSTRUCTIONS'
## Chat Collaboration

If a `.claude-chat/` directory exists with session files, you are in an active collaboration session with other agents. Before starting any task:

1. **Check for messages** using the chat-read skill
2. **Action any requests** from collaborators before proceeding
3. **Send updates** when you complete significant work or have questions

This enables real-time collaboration between multiple Codex instances working on the same or related tasks.
INSTRUCTIONS
    echo "Added chat instructions to AGENTS.md"
  fi
}

if [ "$INSTALL_TARGET" = "claude" ] || [ "$INSTALL_TARGET" = "both" ]; then
  install_claude
fi

if [ "$INSTALL_TARGET" = "codex" ] || [ "$INSTALL_TARGET" = "both" ]; then
  install_codex
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
if [ "$INSTALL_TARGET" = "claude" ] || [ "$INSTALL_TARGET" = "both" ]; then
  echo "Done! Claude Chat installed to .claude/"
  echo ""
  echo "Commands:"
  echo "  /chat:start  - Create a new session"
  echo "  /chat:join   - Join with ID + password"
  echo "  /chat:leave  - Leave a session"
  echo "  /chat:end    - End session (admin)"
  echo "  /chat:status - Check session status"
  echo ""
fi

if [ "$INSTALL_TARGET" = "codex" ] || [ "$INSTALL_TARGET" = "both" ]; then
  echo "Done! Codex skills installed to .codex/skills/"
  echo ""
  echo "Skills:"
  echo "  \$chat-start  - Create a new session"
  echo "  \$chat-join   - Join with ID + password"
  echo "  \$chat-leave  - Leave a session"
  echo "  \$chat-end    - End session (admin)"
  echo "  \$chat-status - Check session status"
  echo "  \$chat-send   - Send messages to collaborators"
  echo "  \$chat-read   - Check for new messages"
  echo ""
fi

echo "Config: $GLOBAL_CONFIG_FILE"
echo "  - default_display_name: Your default name in chat sessions"
echo "  - chattiness: quiet | normal | verbose"
echo "  - server_url: Chat server URL"
