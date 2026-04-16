#!/usr/bin/env bash
# claude-buddy PostToolUse hook
# Detects events in Bash tool output and writes a reaction to the status line.
#
# Combined: PR #4 species reactions + TTY session isolation + PR #13 field fix

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

REACTION_FILE="$STATE_DIR/reaction.${TTY_ID:-default}.json"
COOLDOWN_FILE="$STATE_DIR/.last_reaction.${TTY_ID:-default}"

INPUT=$(cat)

# Read cooldown from config (default 30s, 0 = disabled)
COOLDOWN=30
if [ -f "$CONFIG_FILE" ]; then
  _cd=$(jq -r '.commentCooldown // 30' "$CONFIG_FILE" 2>/dev/null || echo 30)
  # Accept any non-negative integer (including 0 to disable cooldown)
  [[ "$_cd" =~ ^[0-9]+$ ]] && COOLDOWN=$_cd
fi

# Cooldown: configurable
if [ -f "$COOLDOWN_FILE" ]; then
    LAST=$(cat "$COOLDOWN_FILE" 2>/dev/null)
    NOW=$(date +%s)
    DIFF=$(( NOW - ${LAST:-0} ))
    [ "$DIFF" -lt "$COOLDOWN" ] && exit 0
fi

# Extract tool response (PostToolUse schema field is .tool_response — not
# .tool_result, which is the Anthropic SDK's content-block type name and is
# never a key on the hook input payload).
RESULT=$(echo "$INPUT" | jq -r '.tool_response // ""' 2>/dev/null)
[ -z "$RESULT" ] && exit 0

MUTED=$(jq -r '.muted // false' "$STATUS_FILE" 2>/dev/null)
[ "$MUTED" = "true" ] && exit 0

SPECIES=$(jq -r '.species // "blob"' "$STATUS_FILE" 2>/dev/null)
NAME=$(jq -r '.name // "buddy"' "$STATUS_FILE" 2>/dev/null)

REASON=""
REACTION=""

REACTIONS_FILE="$STATE_DIR/reactions.json"

# ─── Pick from a pool by species + event ─────────────────────────────────────
# Reads from reactions.json (exported by: bun run export-reactions)

pick_reaction() {
    local event="$1"
    [ -f "$REACTIONS_FILE" ] || return

    # Try species-specific first, fall back to generic
    local pool
    pool=$(jq -r --arg s "$SPECIES" --arg e "$event" --argjson rand "$RANDOM" \
      '(.species[$s][$e] // .generic[$e] // []) | if length > 0 then .[$rand % length] else empty end' \
      "$REACTIONS_FILE" 2>/dev/null)

    [ -n "$pool" ] && REACTION="$pool"
}

# ─── Detect test failures ─────────────────────────────────────────────────────
if echo "$RESULT" | grep -qiE '\b[1-9][0-9]* (failed|failing)\b|tests? failed|^FAIL(ED)?|✗|✘'; then
    REASON="test-fail"
    pick_reaction "test-fail"

# ─── Detect errors ────────────────────────────────────────────────────────────
elif echo "$RESULT" | grep -qiE '\berror:|\bexception\b|\btraceback\b|\bpanicked at\b|\bfatal:|exit code [1-9]'; then
    REASON="error"
    pick_reaction "error"

# ─── Detect large diffs ──────────────────────────────────────────────────────
elif echo "$RESULT" | grep -qiE '^\+.*[0-9]+ insertions|[0-9]+ files? changed'; then
    LINES=$(echo "$RESULT" | grep -oE '[0-9]+ insertions' | grep -oE '[0-9]+' | head -1)
    if [ "${LINES:-0}" -gt 80 ]; then
        REASON="large-diff"
        pick_reaction "large-diff"
    fi

# ─── Detect success ───────────────────────────────────────────────────────────
elif echo "$RESULT" | grep -qiE '\b(all )?[0-9]+ tests? (passed|ok)\b|✓|✔|PASS(ED)?|\bDone\b|\bSuccess\b|exit code 0|Build succeeded'; then
    REASON="success"
    pick_reaction "success"
fi

# Write reaction if detected
if [ -n "$REASON" ] && [ -n "$REACTION" ]; then
    mkdir -p "$STATE_DIR"
    date +%s > "$COOLDOWN_FILE"

    # Write per-session reaction file (use jq for safe JSON encoding)
    jq -n --arg r "$REACTION" --arg ts "$(date +%s)000" --arg reason "$REASON" \
      '{reaction: $r, timestamp: ($ts | tonumber), reason: $reason}' \
      > "$REACTION_FILE"

    # Increment achievement event counter
    if command -v jq >/dev/null 2>&1; then
        if [ ! -f "$EVENTS_FILE" ]; then
            echo '{}' > "$EVENTS_FILE"
        fi
        case "$REASON" in
            "test-fail")  KEY="tests_failed" ;;
            "error")      KEY="errors_seen" ;;
            "large-diff") KEY="large_diffs" ;;
            *)            KEY="" ;;
        esac
        if [ -n "$KEY" ]; then
            TMP=$(mktemp)
            jq --arg k "$KEY" 'if .[$k] then .[$k] += 1 else .[$k] = 1 end' "$EVENTS_FILE" > "$TMP" 2>/dev/null && mv "$TMP" "$EVENTS_FILE"
        fi

        # Earn coins based on event type (gacha mode only)
        GACHA=$(jq -r '.gachaMode // false' "$CONFIG_FILE" 2>/dev/null || echo false)
        if [ "$GACHA" = "true" ]; then
            COIN_AMT=0
            case "$REASON" in
                "test-fail")  COIN_AMT=2 ;;
                "error")      COIN_AMT=2 ;;
                "large-diff") COIN_AMT=3 ;;
            esac
            if [ "$COIN_AMT" -gt 0 ]; then
                if [ ! -f "$WALLET_FILE" ]; then
                    echo '{}' > "$WALLET_FILE"
                fi
                TMP=$(mktemp)
                jq --argjson amt "$COIN_AMT" '.coins = ((.coins // 0) + $amt) | .totalEarned = ((.totalEarned // 0) + $amt)' "$WALLET_FILE" > "$TMP" 2>/dev/null && mv "$TMP" "$WALLET_FILE"
            fi
        fi
    fi
fi

exit 0
