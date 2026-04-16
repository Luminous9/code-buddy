#!/usr/bin/env bash
# buddy-comment Stop hook
# Extracts hidden buddy comment from Claude's response.
# Claude writes: <!-- buddy: *adjusts tophat* nice code -->
# This hook extracts it and updates the status line bubble.
# The HTML comment is invisible in rendered markdown output.

# shellcheck source=../scripts/paths.sh
source "$(dirname "${BASH_SOURCE[0]}")/../scripts/paths.sh"

STATE_DIR="$BUDDY_STATE_DIR"
STATUS_FILE="$STATE_DIR/status.json"
CONFIG_FILE="$STATE_DIR/config.json"
EVENTS_FILE="$STATE_DIR/events.json"
WALLET_FILE="$STATE_DIR/wallet.json"

[ -f "$STATUS_FILE" ] || exit 0

# ─── Resolve TTY for per-session isolation ───────────────────────────────────
# Walks the process tree to find the TTY device (works in tmux, plain
# terminals, VS Code, SSH — anywhere a PTY is allocated).
TTY_ID=""
PID=$$
for _ in 1 2 3 4 5 6; do
    PID=$(ps -o ppid= -p "$PID" 2>/dev/null | tr -d ' ')
    [ -z "$PID" ] || [ "$PID" = "1" ] && break
    _TTY=$(ps -o tty= -p "$PID" 2>/dev/null | tr -d ' ')
    if [ -n "$_TTY" ] && [ "$_TTY" != "??" ]; then
        TTY_ID="$_TTY"
        break
    fi
done

COOLDOWN_FILE="$STATE_DIR/.last_comment.${TTY_ID:-default}"

# Read cooldown from config (default 30s, 0 = disabled)
COOLDOWN=30
if [ -f "$CONFIG_FILE" ]; then
  _cd=$(jq -r '.commentCooldown // 30' "$CONFIG_FILE" 2>/dev/null || echo 30)
  # Accept any non-negative integer (including 0 to disable cooldown)
  [[ "$_cd" =~ ^[0-9]+$ ]] && COOLDOWN=$_cd
fi

INPUT=$(cat)

# Extract last_assistant_message from hook input
MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // ""' 2>/dev/null)
[ -z "$MSG" ] && exit 0

# Extract <!-- buddy: ... --> comment (portable — no grep -P on macOS)
COMMENT=$(echo "$MSG" | sed -n 's/.*<!-- *buddy: *\(.*[^ ]\) *-->.*/\1/p' | tail -1)
[ -z "$COMMENT" ] && exit 0

# Cooldown: configurable (default 30s)
if [ -f "$COOLDOWN_FILE" ]; then
    LAST=$(cat "$COOLDOWN_FILE" 2>/dev/null)
    NOW=$(date +%s)
    [ $(( NOW - ${LAST:-0} )) -lt "$COOLDOWN" ] && exit 0
fi

mkdir -p "$STATE_DIR"
date +%s > "$COOLDOWN_FILE"

# Write per-session reaction file (use jq for safe JSON encoding)
jq -n --arg r "$COMMENT" --arg ts "$(date +%s)000" \
  '{reaction: $r, timestamp: ($ts | tonumber), reason: "turn"}' \
  > "$STATE_DIR/reaction.${TTY_ID:-default}.json"

# Increment achievement event counters
if command -v jq >/dev/null 2>&1; then
    if [ ! -f "$EVENTS_FILE" ]; then
        echo '{}' > "$EVENTS_FILE"
    fi
    TMP=$(mktemp)
    jq '.turns = ((.turns // 0) + 1)' "$EVENTS_FILE" > "$TMP" 2>/dev/null && mv "$TMP" "$EVENTS_FILE"

    # Earn 1 coin per turn (gacha mode only)
    GACHA=$(jq -r '.gachaMode // false' "$CONFIG_FILE" 2>/dev/null || echo false)
    if [ "$GACHA" = "true" ]; then
        if [ ! -f "$WALLET_FILE" ]; then
            echo '{}' > "$WALLET_FILE"
        fi
        TMP=$(mktemp)
        jq '.coins = ((.coins // 0) + 1) | .totalEarned = ((.totalEarned // 0) + 1)' "$WALLET_FILE" > "$TMP" 2>/dev/null && mv "$TMP" "$WALLET_FILE"
    fi
fi

exit 0
