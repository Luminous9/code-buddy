#!/usr/bin/env bash
# claude-buddy status line — animated, right-aligned multi-line companion
#
# Animation matches the original:
#   - 500ms per tick, sequence: [0,0,0,0,1,0,0,0,-1,0,0,2,0,0,0]
#   - Frame -1 = blink (eyes replaced with "-")
#   - Frames 0,1,2 = the 3 idle art variants per species
#   - refreshInterval: 1s in settings.json cycles the animation
#
# Uses Braille Blank (U+2800) for padding — survives JS .trim()
#
# When running inside buddy-shell (the PTY wrapper), skip status line rendering
# so the buddy doesn't show up twice (once in status line, once in wrapper panel).
[ "$BUDDY_SHELL" = "1" ] && exit 0

# shellcheck source=../scripts/paths.sh
source "$(dirname "${BASH_SOURCE[0]}")/../scripts/paths.sh"

STATE="$BUDDY_STATE_DIR/status.json"

[ -f "$STATE" ] || exit 0

MUTED=$(jq -r '.muted // false' "$STATE" 2>/dev/null)
[ "$MUTED" = "true" ] && exit 0

NAME=$(jq -r '.name // ""' "$STATE" 2>/dev/null)
[ -z "$NAME" ] && exit 0

SPECIES=$(jq -r '.species // ""' "$STATE" 2>/dev/null)
HAT=$(jq -r '.hat // "none"' "$STATE" 2>/dev/null)
RARITY=$(jq -r '.rarity // "common"' "$STATE" 2>/dev/null)
ACHIEVEMENT=$(jq -r '.achievement // ""' "$STATE" 2>/dev/null)
# eye is written to status.json by writeStatusState (v2+); fall back to "°"
E=$(jq -r '.eye // "°"' "$STATE" 2>/dev/null)

cat > /dev/null  # drain stdin

# ─── Resolve TTY for per-session reaction file ──────────────────────────────
# Walks the process tree to find the TTY device (works in tmux panes, plain
# terminals, VS Code, SSH — anywhere a PTY is allocated).
TTY_ID=""
COLS=0
_PID=$$
for _ in 1 2 3 4 5 6; do
    _PID=$(ps -o ppid= -p "$_PID" 2>/dev/null | tr -d ' ')
    [ -z "$_PID" ] || [ "$_PID" = "1" ] && break
    if [ -z "$TTY_ID" ]; then
        _TTY=$(ps -o tty= -p "$_PID" 2>/dev/null | tr -d ' ')
        if [ -n "$_TTY" ] && [ "$_TTY" != "??" ] && [ "$_TTY" != "?" ]; then
            TTY_ID="$_TTY"
        fi
    fi
    # Try to detect terminal width — Linux /proc
    PTY=$(readlink "/proc/${_PID}/fd/0" 2>/dev/null)
    if [ -c "$PTY" ] 2>/dev/null; then
        COLS=$(stty size < "$PTY" 2>/dev/null | awk '{print $2}')
        [ "${COLS:-0}" -gt 40 ] 2>/dev/null && break
    fi
    # macOS: /proc doesn't exist — get TTY name from process table
    if [ "${COLS:-0}" -lt 40 ] 2>/dev/null; then
        _TTY_NAME=$(ps -o tty= -p "$_PID" 2>/dev/null | tr -d ' ')
        if [ -n "$_TTY_NAME" ] && [ "$_TTY_NAME" != "??" ] && [ "$_TTY_NAME" != "?" ]; then
            _TTY_DEV="/dev/$_TTY_NAME"
            if [ -c "$_TTY_DEV" ] 2>/dev/null; then
                COLS=$(stty size < "$_TTY_DEV" 2>/dev/null | awk '{print $2}')
                [ "${COLS:-0}" -gt 40 ] 2>/dev/null && break
            fi
        fi
    fi
done
[ "${COLS:-0}" -lt 40 ] 2>/dev/null && COLS=${COLUMNS:-0}
[ "${COLS:-0}" -lt 40 ] 2>/dev/null && COLS=125

# ─── Animation: frame from timestamp ─────────────────────────────────────────
# Original sequence: [0,0,0,0,1,0,0,0,-1,0,0,2,0,0,0] with 500ms ticks
# Since refreshInterval=1s, each call = 2 ticks. We use seconds as index.
SEQ=(0 0 0 0 1 0 0 0 -1 0 0 2 0 0 0)
SEQ_LEN=${#SEQ[@]}
NOW=$(date +%s)
FRAME_IDX=$(( NOW % SEQ_LEN ))
FRAME=${SEQ[$FRAME_IDX]}

BLINK=0
if [ "$FRAME" -eq -1 ]; then
    BLINK=1
    FRAME=0
fi

# ─── Rarity color (pC4 = dark theme, the default) ────────────────────────────
NC=$'\033[0m'
case "$RARITY" in
  common)    C=$'\033[38;2;153;153;153m' ;;
  uncommon)  C=$'\033[38;2;78;186;101m'  ;;
  rare)      C=$'\033[38;2;177;185;249m' ;;
  epic)      C=$'\033[38;2;175;135;255m' ;;
  legendary) C=$'\033[38;2;255;193;7m'   ;;
  *)         C=$'\033[0m' ;;
esac

B=$'\xe2\xa0\x80'  # Braille Blank U+2800

# ─── Species art: 3 frames each (F0, F1, F2) ────────────────────────────────
# Each frame = 5 lines (L0..L4). L0 is the hat slot — if non-blank, it
# overrides the hat for that frame. Selected by $FRAME.
# --- BEGIN GENERATED SPECIES ART ---
case "$SPECIES" in
  duck)
    case $FRAME in
      0) L0=""; L1="    __"; L2="  <(${E} )___"; L3="   (  ._>"; L4="    \`--'" ;;
      1) L0=""; L1="    __"; L2="  <(${E} )___"; L3="   (  ._>"; L4="    \`--'~" ;;
      2) L0=""; L1="    __"; L2="  <(${E} )___"; L3="   (  .__>"; L4="    \`--'" ;;
    esac ;;
  goose)
    case $FRAME in
      0) L0=""; L1="     (${E}>"; L2="     ||"; L3="   _(__)_"; L4="    ^^^^" ;;
      1) L0=""; L1="    (${E}>"; L2="     ||"; L3="   _(__)_"; L4="    ^^^^" ;;
      2) L0=""; L1="     (${E}>>"; L2="     ||"; L3="   _(__)_"; L4="    ^^^^" ;;
    esac ;;
  blob)
    case $FRAME in
      0) L0=""; L1="   .----."; L2="  ( ${E}  ${E} )"; L3="  (      )"; L4="   \`----'" ;;
      1) L0=""; L1="  .------."; L2=" (  ${E}  ${E}  )"; L3=" (        )"; L4="  \`------'" ;;
      2) L0=""; L1="    .--."; L2="   (${E}  ${E})"; L3="   (    )"; L4="    \`--'" ;;
    esac ;;
  cat)
    case $FRAME in
      0) L0=""; L1="   /\\_/\\"; L2="  ( ${E}   ${E})"; L3="  (  ω  )"; L4="  (\")_(\")" ;;
      1) L0=""; L1="   /\\_/\\"; L2="  ( ${E}   ${E})"; L3="  (  ω  )"; L4="  (\")_(\")~" ;;
      2) L0=""; L1="   /\\-/\\"; L2="  ( ${E}   ${E})"; L3="  (  ω  )"; L4="  (\")_(\")" ;;
    esac ;;
  dragon)
    case $FRAME in
      0) L0=""; L1="  /^\\  /^\\"; L2=" <  ${E}  ${E}  >"; L3=" (   ~~   )"; L4="  \`-vvvv-'" ;;
      1) L0=""; L1="  /^\\  /^\\"; L2=" <  ${E}  ${E}  >"; L3=" (        )"; L4="  \`-vvvv-'" ;;
      2) L0="   ~    ~"; L1="  /^\\  /^\\"; L2=" <  ${E}  ${E}  >"; L3=" (   ~~   )"; L4="  \`-vvvv-'" ;;
    esac ;;
  octopus)
    case $FRAME in
      0) L0=""; L1="   .----."; L2="  ( ${E}  ${E} )"; L3="  (______)"; L4="  /\\/\\/\\/\\" ;;
      1) L0=""; L1="   .----."; L2="  ( ${E}  ${E} )"; L3="  (______)"; L4="  \\/\\/\\/\\/" ;;
      2) L0="     o"; L1="   .----."; L2="  ( ${E}  ${E} )"; L3="  (______)"; L4="  /\\/\\/\\/\\" ;;
    esac ;;
  owl)
    case $FRAME in
      0) L0=""; L1="   /\\  /\\"; L2="  ((${E})(${E}))"; L3="  (  ><  )"; L4="   \`----'" ;;
      1) L0=""; L1="   /\\  /\\"; L2="  ((${E})(${E}))"; L3="  (  ><  )"; L4="   .----." ;;
      2) L0=""; L1="   /\\  /\\"; L2="  ((${E})(-))"; L3="  (  ><  )"; L4="   \`----'" ;;
    esac ;;
  penguin)
    case $FRAME in
      0) L0=""; L1="  .---."; L2="  (${E}>${E})"; L3=" /(   )\\"; L4="  \`---'" ;;
      1) L0=""; L1="  .---."; L2="  (${E}>${E})"; L3=" |(   )|"; L4="  \`---'" ;;
      2) L0="  .---."; L1="  (${E}>${E})"; L2=" /(   )\\"; L3="  \`---'"; L4="   ~ ~" ;;
    esac ;;
  turtle)
    case $FRAME in
      0) L0=""; L1="   _,--._"; L2="  ( ${E}  ${E} )"; L3=" /[______]\\"; L4="  \`\`    \`\`" ;;
      1) L0=""; L1="   _,--._"; L2="  ( ${E}  ${E} )"; L3=" /[______]\\"; L4="   \`\`  \`\`" ;;
      2) L0=""; L1="   _,--._"; L2="  ( ${E}  ${E} )"; L3=" /[======]\\"; L4="  \`\`    \`\`" ;;
    esac ;;
  snail)
    case $FRAME in
      0) L0=""; L1=" ${E}    .--."; L2="  \\  ( @ )"; L3="   \\_\`--'"; L4="  ~~~~~~~" ;;
      1) L0=""; L1="  ${E}   .--."; L2="  |  ( @ )"; L3="   \\_\`--'"; L4="  ~~~~~~~" ;;
      2) L0=""; L1=" ${E}    .--."; L2="  \\  ( @  )"; L3="   \\_\`--'"; L4="   ~~~~~~" ;;
    esac ;;
  ghost)
    case $FRAME in
      0) L0=""; L1="   .----."; L2="  / ${E}  ${E} \\"; L3="  |      |"; L4="  ~\`~\`\`~\`~" ;;
      1) L0=""; L1="   .----."; L2="  / ${E}  ${E} \\"; L3="  |      |"; L4="  \`~\`~~\`~\`" ;;
      2) L0="    ~  ~"; L1="   .----."; L2="  / ${E}  ${E} \\"; L3="  |      |"; L4="  ~~\`~~\`~~" ;;
    esac ;;
  axolotl)
    case $FRAME in
      0) L0=""; L1="}~(______)~{"; L2="}~(${E} .. ${E})~{"; L3="  ( .--. )"; L4="  (_/  \\_)" ;;
      1) L0=""; L1="~}(______){~"; L2="~}(${E} .. ${E}){~"; L3="  ( .--. )"; L4="  (_/  \\_)" ;;
      2) L0=""; L1="}~(______)~{"; L2="}~(${E} .. ${E})~{"; L3="  (  --  )"; L4="  ~_/  \\_~" ;;
    esac ;;
  capybara)
    case $FRAME in
      0) L0=""; L1="  n______n"; L2=" ( ${E}    ${E} )"; L3=" (   oo   )"; L4="  \`------'" ;;
      1) L0=""; L1="  n______n"; L2=" ( ${E}    ${E} )"; L3=" (   Oo   )"; L4="  \`------'" ;;
      2) L0="    ~  ~"; L1="  u______n"; L2=" ( ${E}    ${E} )"; L3=" (   oo   )"; L4="  \`------'" ;;
    esac ;;
  cactus)
    case $FRAME in
      0) L0=""; L1=" n  ____  n"; L2=" | |${E}  ${E}| |"; L3=" |_|    |_|"; L4="   |    |" ;;
      1) L0=""; L1="    ____"; L2=" n |${E}  ${E}| n"; L3=" |_|    |_|"; L4="   |    |" ;;
      2) L0=" n        n"; L1=" |  ____  |"; L2=" | |${E}  ${E}| |"; L3=" |_|    |_|"; L4="   |    |" ;;
    esac ;;
  robot)
    case $FRAME in
      0) L0=""; L1="   .[||]."; L2="  [ ${E}  ${E} ]"; L3="  [ ==== ]"; L4="  \`------'" ;;
      1) L0=""; L1="   .[||]."; L2="  [ ${E}  ${E} ]"; L3="  [ -==- ]"; L4="  \`------'" ;;
      2) L0="     *"; L1="   .[||]."; L2="  [ ${E}  ${E} ]"; L3="  [ ==== ]"; L4="  \`------'" ;;
    esac ;;
  rabbit)
    case $FRAME in
      0) L0=""; L1="   (\\__/)"; L2="  ( ${E}  ${E} )"; L3=" =(  ..  )="; L4="  (\")__(\")" ;;
      1) L0=""; L1="   (|__/)"; L2="  ( ${E}  ${E} )"; L3=" =(  ..  )="; L4="  (\")__(\")" ;;
      2) L0=""; L1="   (\\__/)"; L2="  ( ${E}  ${E} )"; L3=" =( .  . )="; L4="  (\")__(\")" ;;
    esac ;;
  mushroom)
    case $FRAME in
      0) L0=""; L1=" .-o-OO-o-."; L2="(__________)"; L3="   |${E}  ${E}|"; L4="   |____|" ;;
      1) L0=""; L1=" .-O-oo-O-."; L2="(__________)"; L3="   |${E}  ${E}|"; L4="   |____|" ;;
      2) L0="   . o  ."; L1=" .-o-OO-o-."; L2="(__________)"; L3="   |${E}  ${E}|"; L4="   |____|" ;;
    esac ;;
  chonk)
    case $FRAME in
      0) L0=""; L1="  /\\    /\\"; L2=" ( ${E}    ${E} )"; L3=" (   ..   )"; L4="  \`------'" ;;
      1) L0=""; L1="  /\\    /|"; L2=" ( ${E}    ${E} )"; L3=" (   ..   )"; L4="  \`------'" ;;
      2) L0=""; L1="  /\\    /\\"; L2=" ( ${E}    ${E} )"; L3=" (   ..   )"; L4="  \`------'~" ;;
    esac ;;
  spider)
    case $FRAME in
      0) L0=""; L1="    /°oo°\\"; L2=" ,.( ¥vv¥ ).,"; L3="//¨\\\\¥¨¨¥//¨\\\\"; L4="üü  U    U  üü" ;;
      1) L0=""; L1="    /°oo°\\"; L2=" ,.( ¥vv¥ ).,"; L3="//¨\\\\ ¥¥ //¨\\\\"; L4="üü  U    U  üü" ;;
      2) L0=""; L1="  n /°oo°\\ n"; L2=" ,\\\\ ¥vv¥ //,"; L3="//¨  ¥¨¨¥  ¨\\\\"; L4="üü          üü" ;;
    esac ;;
  beetle)
    case $FRAME in
      0) L0=""; L1=" }{  _"; L2="  \\\\_) \\_ ______"; L3="   \\ ${E}   |    _ _\\"; L4="    \`¯_/\`¬¯\\\\¸¬¯\\\\¸" ;;
      1) L0=" }{  _"; L1="  \\\\_) \\_ ,–––.===;"; L2="   \\ ${E}   |( __)--'"; L3="    \`¯ /\`¬\\\\ ¬\\\\"; L4="      '     \`   \`" ;;
      2) L0=""; L1="}{  _"; L2=" \\\\_) \\_ ______"; L3="  \\ ${E}   |    _ _\\"; L4="   \`¯<_\`¬\\\\_¸¬\\\\_¸" ;;
    esac ;;
  *)
    L0=""; L1="(${E}${E})"; L2="(  )"; L3=""; L4="" ;;
esac
# --- END GENERATED SPECIES ART ---

# ─── Blink: replace eyes with "-" ────────────────────────────────────────────
if [ "$BLINK" -eq 1 ]; then
    L0="${L0//${E}/-}"
    L1="${L1//${E}/-}"
    L2="${L2//${E}/-}"
    L3="${L3//${E}/-}"
    L4="${L4//${E}/-}"
fi

# ─── Hat ──────────────────────────────────────────────────────────────────────
# --- BEGIN GENERATED HAT ART ---
BARE_HAT=""
case "$HAT" in
  crown) BARE_HAT="\\^^^/" ;;
  tophat) BARE_HAT="[___]" ;;
  propeller) BARE_HAT="-+-" ;;
  halo) BARE_HAT="(   )" ;;
  wizard) BARE_HAT="/^\\" ;;
  beanie) BARE_HAT="(___)" ;;
  tinyduck) BARE_HAT=",>" ;;
esac

HAT_LINE=""
if [ -n "$BARE_HAT" ]; then
  ART_W=12
  HAT_OFFSET=0
  case "$SPECIES" in
    duck) ART_W=12 ;;
    goose) ART_W=12 ;;
    blob) ART_W=12 ;;
    cat) ART_W=12 ;;
    dragon) ART_W=12 ;;
    octopus) ART_W=12 ;;
    owl) ART_W=12 ;;
    penguin) ART_W=12 ;;
    turtle) ART_W=12 ;;
    snail) ART_W=12 ;;
    ghost) ART_W=12 ;;
    axolotl) ART_W=12 ;;
    capybara) ART_W=12 ;;
    cactus) ART_W=12 ;;
    robot) ART_W=12 ;;
    rabbit) ART_W=12 ;;
    mushroom) ART_W=12 ;;
    chonk) ART_W=12 ;;
    spider) ART_W=14 ;;
    beetle) ART_W=20
      case $FRAME in
        0) HAT_OFFSET=-4 ;;
        1) HAT_OFFSET=-4 ;;
        2) HAT_OFFSET=-5 ;;
      esac ;;
  esac
  BARE_LEN=${#BARE_HAT}
  PAD=$(( (ART_W - BARE_LEN) / 2 + HAT_OFFSET ))
  [ "$PAD" -lt 0 ] && PAD=0
  HAT_LINE="$(printf '%*s%s' "$PAD" '' "$BARE_HAT")"
fi
# --- END GENERATED HAT ART ---

# ─── Reaction bubble (read from per-session file, with TTL check) ────────────
BUBBLE=""
if [ -n "$ACHIEVEMENT" ] && [ "$ACHIEVEMENT" != "null" ] && [ "$ACHIEVEMENT" != "" ]; then
    BUBBLE=$'\xf0\x9f\x8f\x86'" $ACHIEVEMENT"
fi
REACTION_FILE="$BUDDY_STATE_DIR/reaction.${TTY_ID:-default}.json"
REACTION=""
REACTION_TTL=0
CONFIG_FILE="$BUDDY_STATE_DIR/config.json"
if [ -f "$CONFIG_FILE" ]; then
    _ttl=$(jq -r '.reactionTTL // 0' "$CONFIG_FILE" 2>/dev/null || echo 0)
    case "$_ttl" in ''|*[!0-9]*) ;; *) REACTION_TTL="$_ttl" ;; esac
fi
if [ -f "$REACTION_FILE" ]; then
    _REACTION=$(jq -r '.reaction // ""' "$REACTION_FILE" 2>/dev/null)
    if [ -n "$_REACTION" ] && [ "$_REACTION" != "null" ]; then
        FRESH=0
        if [ "$REACTION_TTL" -eq 0 ]; then
            FRESH=1
        else
            TS=$(jq -r '.timestamp // 0' "$REACTION_FILE" 2>/dev/null || echo 0)
            if [ "$TS" != "0" ]; then
                NOW=$(date +%s)
                AGE=$(( NOW - TS / 1000 ))
                [ "$AGE" -lt "$REACTION_TTL" ] && FRESH=1
            fi
        fi
        [ "$FRESH" -eq 1 ] && REACTION="$_REACTION"
    fi
fi
if [ -n "$REACTION" ]; then
    if [ -n "$BUBBLE" ]; then
        BUBBLE="$BUBBLE | \"${REACTION}\""
    else
        BUBBLE="\"${REACTION}\""
    fi
fi

# ─── Build art lines ─────────────────────────────────────────────────────────
ART_LINES=("$L1" "$L2" "$L3")
[ -n "$L4" ] && ART_LINES+=("$L4")

# Center the name
NAME_LEN=${#NAME}
ART_CENTER=4
NAME_PAD=$(( ART_CENTER - NAME_LEN / 2 ))
[ "$NAME_PAD" -lt 0 ] && NAME_PAD=0
NAME_LINE="$(printf '%*s%s' "$NAME_PAD" '' "$NAME")"

# ─── Build all art lines ──────────────────────────────────────────────────────
DIM=$'\033[2;3m'

ALL_LINES=()
ALL_COLORS=()
# L0 is the hat slot — if the species art has non-space content there,
# it overrides the hat for this frame; otherwise show the hat as usual.
L0_TRIMMED="${L0//[[:space:]]/}"
if [ -n "$L0_TRIMMED" ]; then
    ALL_LINES+=("$L0"); ALL_COLORS+=("$C")
elif [ -n "$HAT_LINE" ]; then
    ALL_LINES+=("$HAT_LINE"); ALL_COLORS+=("$C")
fi
for line in "${ART_LINES[@]}"; do
    ALL_LINES+=("$line"); ALL_COLORS+=("$C")
done
ALL_LINES+=("$NAME_LINE"); ALL_COLORS+=("$DIM")

ART_W=14
ART_COUNT=${#ALL_LINES[@]}

# ─── Speech bubble (left of art, word-wrapped) ──────────────────────────────
# Strip the quotes we added earlier
BUBBLE_TEXT=""
if [ -n "$BUBBLE" ]; then
    BUBBLE_TEXT="${BUBBLE%\"}"
    BUBBLE_TEXT="${BUBBLE_TEXT#\"}"
fi

# ─── Display width (accounts for wide Unicode chars like emoji) ──────────────
display_width() {
  local str="$1"
  # Fast path: pure ASCII — ${#str} is correct and avoids forking perl
  if [[ "$str" != *[^[:ascii:]]* ]]; then
    echo "${#str}"
    return
  fi
  if command -v perl >/dev/null 2>&1; then
    printf '%s' "$str" | perl -CS -ne '
      my $w = 0;
      for (split //) {
        my $c = ord;
        if ($c > 0xFFFF || ($c >= 0x1100 && $c <= 0x115F) ||
            ($c >= 0x2E80 && $c <= 0xA4CF) ||
            ($c >= 0xAC00 && $c <= 0xD7A3) ||
            ($c >= 0xF900 && $c <= 0xFAFF) ||
            ($c >= 0xFE10 && $c <= 0xFE6F) ||
            ($c >= 0xFF01 && $c <= 0xFF60) ||
            ($c >= 0xFFE0 && $c <= 0xFFE6)) {
          $w += 2;
        } else {
          $w += 1;
        }
      }
      print $w;
    '
  else
    echo "${#str}"
  fi
}

# ─── Word-wrap bubble text ────────────────────────────────────────────────────
INNER_W=28
TEXT_LINES=()
if [ -n "$BUBBLE_TEXT" ]; then
    WORDS=($BUBBLE_TEXT)
    CUR_LINE=""
    CUR_DW=0
    for word in "${WORDS[@]}"; do
        WORD_DW=$(display_width "$word")
        if [ -z "$CUR_LINE" ]; then
            CUR_LINE="$word"
            CUR_DW=$WORD_DW
        elif [ $(( CUR_DW + 1 + WORD_DW )) -le $INNER_W ]; then
            CUR_LINE="$CUR_LINE $word"
            CUR_DW=$(( CUR_DW + 1 + WORD_DW ))
        else
            TEXT_LINES+=("$CUR_LINE")
            CUR_LINE="$word"
            CUR_DW=$WORD_DW
        fi
    done
    [ -n "$CUR_LINE" ] && TEXT_LINES+=("$CUR_LINE")
fi

TEXT_COUNT=${#TEXT_LINES[@]}

# Build box as plain strings (no ANSI). Color applied at output time.
# Box display width = INNER_W + 4:  "| " + text(INNER_W) + " |"
BOX_W=$(( INNER_W + 4 ))
BUBBLE_LINES=()
BUBBLE_TYPES=()  # "border" or "text" — determines coloring
if [ $TEXT_COUNT -gt 0 ]; then
    # Top border
    BORDER=$(printf '%*s' "$(( BOX_W - 2 ))" '' | tr ' ' '-')
    BUBBLE_LINES+=(".${BORDER}.")
    BUBBLE_TYPES+=("border")
    # Text rows: "| text padded |"
    for tl in "${TEXT_LINES[@]}"; do
        tpad=$(( INNER_W - $(display_width "$tl") ))
        [ "$tpad" -lt 0 ] && tpad=0
        padding=$(printf '%*s' "$tpad" '')
        BUBBLE_LINES+=("| ${tl}${padding} |")
        BUBBLE_TYPES+=("text")
    done
    # Bottom border
    BUBBLE_LINES+=("\`${BORDER}'")
    BUBBLE_TYPES+=("border")
fi

BUBBLE_COUNT=${#BUBBLE_LINES[@]}

# ─── Right-align with bubble box to the left ─────────────────────────────────
GAP=2
if [ $BUBBLE_COUNT -gt 0 ]; then
    TOTAL_W=$(( BOX_W + GAP + ART_W ))
else
    TOTAL_W=$ART_W
fi
MARGIN=8
PAD=$(( COLS - TOTAL_W - MARGIN ))
[ "$PAD" -lt 0 ] && PAD=0

SPACER=$(printf "${B}%${PAD}s" "")
GAP_STR=$(printf '%*s' "$GAP" '')

# Vertically center bubble box on the art
BUBBLE_START=0
if [ $BUBBLE_COUNT -gt 0 ] && [ $BUBBLE_COUNT -lt $ART_COUNT ]; then
    BUBBLE_START=$(( (ART_COUNT - BUBBLE_COUNT) / 2 ))
fi

# ─── Find the connector line (middle text line → points to buddy's mouth) ─────
# The connector goes on the middle text row of the bubble
CONNECTOR_BI=-1
if [ $BUBBLE_COUNT -gt 2 ]; then
    # text rows are indices 1..(BUBBLE_COUNT-2), pick the middle one
    FIRST_TEXT=1
    LAST_TEXT=$(( BUBBLE_COUNT - 2 ))
    CONNECTOR_BI=$(( (FIRST_TEXT + LAST_TEXT) / 2 ))
fi

# ─── Output: merged bubble box + connector + art per line ─────────────────────
TOTAL_ROWS=$ART_COUNT
if [ $BUBBLE_COUNT -gt 0 ] && [ $(( BUBBLE_START + BUBBLE_COUNT )) -gt $TOTAL_ROWS ]; then
    TOTAL_ROWS=$(( BUBBLE_START + BUBBLE_COUNT ))
fi
for (( i=0; i<TOTAL_ROWS; i++ )); do
    if [ $i -lt $ART_COUNT ]; then
        art_part="${ALL_COLORS[$i]}${ALL_LINES[$i]}${NC}"
    else
        art_part=$(printf '%*s' "$ART_W" '')
    fi

    if [ $BUBBLE_COUNT -gt 0 ]; then
        bi=$(( i - BUBBLE_START ))
        if [ $bi -ge 0 ] && [ $bi -lt $BUBBLE_COUNT ]; then
            bline="${BUBBLE_LINES[$bi]}"
            btype="${BUBBLE_TYPES[$bi]}"

            # Connector: "-- " on the middle text line, spaces otherwise
            if [ $bi -eq $CONNECTOR_BI ]; then
                gap="${C}--${NC} "
            else
                gap="   "
            fi

            if [ "$btype" = "border" ]; then
                echo "${SPACER}${C}${bline}${NC}${gap}${art_part}"
            else
                pipe_l="${bline:0:1}"
                pipe_r="${bline: -1}"
                inner="${bline:1:$(( ${#bline} - 2 ))}"
                echo "${SPACER}${C}${pipe_l}${NC}${DIM}${inner}${NC}${C}${pipe_r}${NC}${gap}${art_part}"
            fi
        else
            empty=$(printf '%*s' "$BOX_W" '')
            echo "${SPACER}${empty}   ${art_part}"
        fi
    else
        echo "${SPACER}${art_part}"
    fi
done

exit 0
