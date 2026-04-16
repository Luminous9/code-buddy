# Claude Code + Codex Port Plan

## Goal

Support both Claude Code and ChatGPT Codex CLI from one codebase without forking the buddy engine, reactions, or state model.

The target end state is:

- One shared buddy core
- One Claude adapter
- One Codex adapter
- A small, explicit compatibility layer for host-specific config, hooks, skills, and UI

## Current Assessment

### What already ports well

These parts are mostly host-agnostic today:

- `server/engine.ts`
- `server/reactions.ts`
- `server/packs.ts`
- `server/pull.ts`
- `server/wallet.ts`
- `server/achievements.ts`
- most of `server/state.ts`
- MCP tool definitions in `server/index.ts`

These are the core buddy product and should remain shared.

### What is Claude-specific today

These parts are tightly coupled to Claude Code:

- `server/path.ts`
- `scripts/paths.sh`
- `cli/install.ts`
- `cli/uninstall.ts`
- `cli/disable.ts`
- `cli/doctor.ts`
- `statusline/buddy-status.sh`
- `skills/buddy/SKILL.md`
- hook payload assumptions in:
  - `hooks/react.sh`
  - `hooks/buddy-comment.sh`
  - `hooks/name-react.sh`

### What Codex appears to support

As of April 15, 2026, Codex CLI has:

- MCP support
- skills / plugins
- hooks behind the experimental `codex_hooks` feature
- a native footer status line configured via `tui.status_line`

Important constraint:

- Codex documents `tui.status_line` as built-in footer item identifiers, not an arbitrary shell command renderer.
- That means behavior parity looks feasible now, while full visual parity with Claude's custom status line is still unclear.

## Product Strategy

Build the Codex port in two layers:

### Layer 1: shared behavioral buddy

This should work in both Claude Code and Codex:

- buddy generation
- stable identity / same buddy per user
- reactions to tool results
- reactions to user name mentions
- end-of-turn buddy comments
- buddy commands via MCP tools
- achievements, gacha, wallet, saved buddies

### Layer 2: host-specific visual experience

Claude Code:

- keep current custom status line approach

Codex:

- start with hooks + skill/plugin support
- use native footer configuration only where useful
- treat rich always-visible ASCII art as a later enhancement
- if needed, provide an optional wrapper mode similar to `buddy-shell`

## Architecture Proposal

Refactor into three logical layers.

### 1. Shared core

Keep all buddy logic here:

- `server/engine.ts`
- `server/reactions.ts`
- `server/packs.ts`
- `server/pull.ts`
- `server/wallet.ts`
- `server/achievements.ts`
- state storage logic
- MCP tool implementation logic

### 2. Host adapters

Add a dedicated adapter area:

```text
adapters/
  claude/
  codex/
```

Each adapter owns:

- config path resolution
- install / uninstall behavior
- hooks registration
- skill / plugin registration
- UI integration points

### 3. Shared shell hook logic

Split shell hooks into:

```text
hooks/
  shared/
    react.sh
    comment.sh
    name-react.sh
  claude/
    react.sh
    comment.sh
    name-react.sh
  codex/
    react.sh
    comment.sh
    name-react.sh
```

The host-specific wrappers should only:

- read the host hook payload
- normalize field names
- forward a tiny normalized JSON payload into the shared script

This keeps behavior logic in one place and isolates host payload drift.

## Recommended Refactor Steps

### Phase 0: prepare the codebase

Goal: make the current Claude implementation easier to extend without behavior changes.

Work:

- extract host-neutral path helpers from `server/path.ts`
- separate buddy state location from host config location
- introduce a `Host` type:
  - `"claude"`
  - `"codex"`
- move Claude-only install logic out of generic CLI entry points

Deliverable:

- Claude behavior unchanged
- cleaner seams for Codex support

### Phase 1: make paths and state host-aware

Add explicit path resolvers, for example:

- `buddyStateDir()`
- `hostConfigDir(host)`
- `hostUserConfigPath(host)`
- `hostHooksPath(host)`
- `hostSkillDir(host, name)`

Notes:

- Decide whether Claude and Codex should share the same buddy state directory.
- Recommended default: shared state, separate host config.

Reasoning:

- users likely want the same buddy identity, saved roster, and wallet across tools
- install/uninstall should never cross-touch the other host's config

### Phase 2: normalize hook execution

Move logic out of the current host-specific hook scripts.

Shared normalized event shapes:

```json
{
  "event": "post_tool_use",
  "tool_name": "Bash",
  "tool_output": "..."
}
```

```json
{
  "event": "stop",
  "last_assistant_message": "..."
}
```

```json
{
  "event": "user_prompt_submit",
  "prompt": "..."
}
```

Claude wrappers should translate Claude hook payloads into that shape.
Codex wrappers should translate Codex hook payloads into that shape.

### Phase 3: add a Codex installer

Create Codex-specific install commands:

- `cli/install-codex.ts`
- `cli/uninstall-codex.ts`
- `cli/doctor-codex.ts`

Installer responsibilities:

- enable `features.codex_hooks = true`
- install or merge `hooks.json`
- register buddy MCP server for Codex
- install Codex skill / plugin assets
- avoid overwriting unrelated user config

Codex config targets likely include:

- `~/.codex/config.toml`
- `~/.codex/hooks.json`
- repo-local `.codex/` assets when appropriate

### Phase 4: adapt the buddy UX for Codex

Claude command surface:

- keep `/buddy`

Codex command surface:

- expose buddy actions through a Codex skill and/or plugin
- keep MCP tool names stable so both hosts talk to the same tool layer

Recommended Codex UX:

- a `buddy` skill that routes commands like show, pet, stats, rename, save, summon
- end-of-turn comments handled by Codex `Stop` hook
- user-mention reactions handled by Codex `UserPromptSubmit` hook
- tool-result reactions handled by Codex `PostToolUse`

### Phase 5: decide on Codex visuals

There are three possible levels:

#### Level A: no persistent visual UI

Buddy is reactive and conversational only.

Pros:

- easiest to ship
- closest to documented Codex extension points

Cons:

- loses the always-visible pet feeling

#### Level B: partial native footer integration

Use Codex's built-in `/statusline` support where possible.

Pros:

- native Codex UX

Cons:

- docs currently describe built-in footer item identifiers, not custom shell-rendered buddy art
- likely insufficient for full ASCII-art parity

#### Level C: optional wrapper mode

Launch Codex inside a companion wrapper, similar to `buddy-shell`.

Pros:

- best chance at preserving a visible pet

Cons:

- not truly native TUI integration
- more terminal complexity

Recommendation:

- ship Level A first
- investigate Level B in parallel
- treat Level C as optional enhancement

## Concrete File Plan

### New files

```text
docs/codex-port-plan.md
adapters/claude/path.ts
adapters/codex/path.ts
adapters/claude/install.ts
adapters/codex/install.ts
adapters/claude/uninstall.ts
adapters/codex/uninstall.ts
hooks/shared/react.sh
hooks/shared/comment.sh
hooks/shared/name-react.sh
hooks/claude/react.sh
hooks/claude/comment.sh
hooks/claude/name-react.sh
hooks/codex/react.sh
hooks/codex/comment.sh
hooks/codex/name-react.sh
cli/install-claude.ts
cli/install-codex.ts
cli/uninstall-claude.ts
cli/uninstall-codex.ts
cli/doctor-codex.ts
```

### Existing files to refactor

`server/path.ts`

- split host-agnostic buddy-state logic from Claude-specific config logic

`scripts/paths.sh`

- replace with host-aware shell path helpers or separate host-specific variants

`cli/index.ts`

- add explicit commands for Claude and Codex install flows

`cli/install.ts`

- either become Claude-only or become a dispatcher

`cli/uninstall.ts`

- same treatment as installer

`hooks/react.sh`
`hooks/buddy-comment.sh`
`hooks/name-react.sh`

- convert into shared logic or Claude wrappers

`README.md`

- after Codex MVP lands, update docs to present buddy as dual-host

## Proposed CLI Surface

Recommended new commands:

```text
bun run install-claude
bun run install-codex
bun run uninstall-claude
bun run uninstall-codex
bun run doctor-claude
bun run doctor-codex
```

Optional convenience aliases:

```text
bun run install
```

This could:

- install Claude only when Claude is detected
- install Codex only when Codex is detected
- or install both with a prompt / flag later

For now, explicit commands are safer.

## Testing Plan

### Unit tests

Add tests for:

- host path resolution
- config merge helpers
- hook payload normalization
- state sharing between Claude and Codex

### Integration tests

Claude:

- install writes expected Claude config
- uninstall removes only Claude entries

Codex:

- install writes expected Codex config
- uninstall removes only Codex entries

Hook tests:

- Claude `PostToolUse`, `Stop`, `UserPromptSubmit`
- Codex `PostToolUse`, `Stop`, `UserPromptSubmit`

### Manual smoke tests

Claude:

- `/buddy`
- `/buddy pet`
- status line animation
- end-of-turn extraction

Codex:

- skill invocation
- hooks firing
- end-of-turn reaction extraction
- name mention reaction
- MCP connectivity

## Main Risks

### 1. Codex hooks are experimental

Risk:

- hook payloads or registration rules may change

Mitigation:

- isolate Codex parsing in tiny wrapper scripts
- do not spread Codex-specific assumptions across the codebase

### 2. Visual parity may not be possible natively

Risk:

- Codex may not support arbitrary custom-rendered footer content

Mitigation:

- define MVP around behavioral parity, not visual parity
- keep wrapper mode optional

### 3. Installers can become brittle

Risk:

- mutating multiple host configs can introduce regressions

Mitigation:

- write narrow merge helpers
- make uninstall host-scoped
- add install/uninstall snapshot tests

## Recommended Delivery Order

1. host/path refactor with no behavior change
2. shared hook normalization layer
3. Codex install/uninstall support
4. Codex skill/plugin MVP
5. Codex visual experiments
6. README and docs refresh

## Definition of Done for Codex MVP

Codex MVP should be considered complete when all of the following work:

- buddy tools available in Codex via MCP
- buddy skill or plugin command surface available in Codex
- `PostToolUse` reactions working in Codex
- `UserPromptSubmit` name reactions working in Codex
- `Stop` end-of-turn extraction working in Codex
- Codex install/uninstall does not break Claude support
- same saved buddy state can be used from both hosts

Visual always-on ASCII rendering is not required for MVP.

## Follow-up Questions To Resolve During Implementation

- Should Claude and Codex share one state directory by default?
- Should the Codex install be global, repo-local, or both?
- Should we ship Codex support first as a plugin, a skill, or both?
- Do we want one repo name and brand, or a broader tool name than `claude-buddy`?

## Sources

- Codex hooks: https://developers.openai.com/codex/hooks
- Codex config reference: https://developers.openai.com/codex/config-reference
- Codex slash commands / status line: https://developers.openai.com/codex/cli/slash-commands#configure-footer-items-with-statusline
