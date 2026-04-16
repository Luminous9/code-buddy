<div align="center">

<img src="https://placehold.co/120x120/6366f1/ffffff?text=%F0%9F%A6%89" alt="code-buddy logo" width="120" />

# Code Buddy

### Luminous9's fork of `claude-buddy` with a new `code-buddy` identity and a more collectible, customizable terminal companion

[![License](https://img.shields.io/github/license/Luminous9/code-buddy?style=flat-square&color=10b981)](LICENSE)
[![Stars](https://img.shields.io/github/stars/Luminous9/code-buddy?style=flat-square&color=f59e0b)](https://github.com/Luminous9/code-buddy/stargazers)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-v2.1.80%2B-8b5cf6?style=flat-square)](https://claude.ai/code)
[![Platform](https://img.shields.io/badge/platform-linux%20%7C%20macOS-blue?style=flat-square)](#requirements)
[![MCP](https://img.shields.io/badge/powered%20by-MCP-ec4899?style=flat-square)](https://modelcontextprotocol.io)

<br>

<img src="docs/hero.gif" alt="code-buddy in action" width="800" />

<br><br>

> This project started as a fork of [1270011/claude-buddy](https://github.com/1270011/claude-buddy), which restored the removed Claude Code buddy and added new features like the multi-buddy menagerie. This fork keeps that goal, but pushes it further with a gacha-style collection system (optional), new species, LLM-generated buddy souls, better session isolation, and the first pieces of future multi-host support for similar tools like Codex CLI.

</div>

## What This Fork Is

This repo is still Claude Code-first today. It installs the same core MCP server, `/buddy` skill, hooks, and status line integrations that make the original buddy system work inside Claude Code.

The difference is that this fork treats the buddy system more like an evolving companion game:

- Your original account buddy is still deterministic and stable.
- You can now collect additional buddies through a coin-based gacha system. If you prefer the old free hunt/search flow, you can turn gacha mode off.
- Species are organized into packs, so new themed groups can be added without rewriting the whole engine.
- Pulled buddies can get LLM-generated names and personalities instead of relying only on static templates.
- The project now has an initial `hostType` setting so future Claude Code and Codex support can share the same core state/config.

## Highlights

- Adds a full gacha mode with coins earned through using Claude Code, pity counters, pull animations, wallet tracking, and achievements.
- Uses pack-based species data, with new themed packs and species planned to be added (so far have added spider and beetle to the new Insects pack).
- Adds early Codex integration work for soul generation, so it can work even if you don't have Claude Code.

## Requirements

- [bun](https://bun.sh/install) on `PATH`
- Claude Code v2.1.80+ for the full in-editor integration
- Linux or macOS
- `jq` on `PATH`

Codex support in this fork is still partial. Right now, the main installed experience isfor Claude Code.

## Quick Start

```bash
git clone https://github.com/Luminous9/code-buddy
cd code-buddy
bun install
bun run install-buddy
```

Then restart Claude Code and type `/buddy`.

Optional next step if you want the classic non-gacha flow:

```bash
bun run settings gacha off
```

Notes:

- The repo and optional global CLI command are both now `code-buddy`.
- `host codex` currently affects the default soul-generation provider and is an early step toward broader Codex support, not a full native Codex port yet.

### Multiple Claude profiles?

If you run Claude Code with `CLAUDE_CONFIG_DIR` set, use the same env var when installing so buddy lands in the matching profile:

```bash
CLAUDE_CONFIG_DIR=~/.claude-personal bun run install-buddy
CLAUDE_CONFIG_DIR=~/.claude-personal bun run uninstall
```

Each profile gets its own MCP entry, skill, hooks, status line config, and `buddy-state` directory.

---

<details>
<summary><b>🎰 &nbsp; Gacha System</b></summary>

<br>

This fork enables gacha mode so you can start collecting buddies beyond your original deterministic account buddy through a fun gradual process.

### How it works

- Earn coins through normal use: turns, errors, test failures, large diffs, sessions, active days, and pets.
- Spend `50` coins per pull to hatch a random buddy.
- While gacha mode is on, free hunt/pick acquisition is disabled and pulls become the main way to obtain new buddies.
- Every pull updates pity counters:
    - `50` pulls without an epic or better guarantees epic+
    - `100` pulls without a legendary guarantees legendary
- Pulled buddies can be kept in your menagerie and summoned later.

### Commands

In Claude Code:

- `/buddy pull`
- `/buddy wallet`
- `/buddy gacha on`
- `/buddy gacha off`
- `/buddy packs`

In the terminal:

- `bun run pull`
- `bun run settings gacha on`
- `bun run settings gacha off`
- `bun run settings`

</details>

---

<details>
<summary><b>🧬 &nbsp; Species, Packs, and Rotation</b></summary>

<br>

The original buddy is still generated deterministically from your account identity. Gacha pulls are different: they generate new buddies from the active pack pool.

### Core Pack

The original `core` pack is always available and contains the 18 classic species:

`duck`, `goose`, `blob`, `cat`, `dragon`, `octopus`, `owl`, `penguin`, `turtle`, `snail`, `ghost`, `axolotl`, `capybara`, `cactus`, `robot`, `rabbit`, `mushroom`, `chonk`

These are still previewed here because they are the familiar baseline species from the original Claude Code buddy feature:

```text
 duck        goose       blob        cat         dragon      octopus
   __         (°>        .----.       /\_/\      /^\  /^\     .----.
 <(° )___      ||       ( °  ° )    ( °   °)   <  °  °  >   ( °  ° )
  (  ._>     _(__)_     (      )    (  ω  )    (   ~~   )   (______)
   `--'       ^^^^       `----'     (")_(")     `-vvvv-'    /\/\/\/\

 owl         penguin     turtle      snail       ghost       axolotl
  /\  /\      .---.       _,--._    °    .--.    .----.    }~(______)~{
 ((°)(°))    (°>°)       ( °  ° )    \  ( @ )   / °  ° \  }~(° .. °)~{
 (  ><  )   /(   )\      [______]     \_`--'    |      |    ( .--. )
  `----'     `---'       ``    ``    ~~~~~~~    ~`~``~`~     (_/  \_)

 capybara    cactus      robot       rabbit      mushroom    chonk
 n______n   n  ____  n    .[||].      (\__/)    .-o-OO-o-.  /\    /\
( °    ° )  | |°  °| |   [ °  ° ]    ( °  ° )  (__________)( °    ° )
(   oo   )  |_|    |_|   [ ==== ]   =(  ..  )=    |°  °|   (   ..   )
 `------'     |    |      `------'   (")__(")      |____|    `------'
```

### Additional Packs

This fork introduces a pack system so new species can ship as themed expansions.

Current additional pack:

- `insects`
    - `spider`
    - `beetle`

To preserve some discovery, this README does not spoil the full ASCII art for expansion-pack species.

### Rotation

- `core` is always available.
- Non-core packs are designed to rotate as featured pull pools.
- At the moment there is one released non-core pack, so the current extra runtime pack is `insects`.

### Rarity and Stats

Every buddy still has:

- a rarity: `common`, `uncommon`, `rare`, `epic`, `legendary`
- five core stats: `DEBUGGING`, `PATIENCE`, `CHAOS`, `WISDOM`, `SNARK`

Pulled buddies also get generated souls, so two buddies can feel much more distinct even when they share a species or rarity.

</details>

---

<details>
<summary><b>💬 &nbsp; Souls and Personality Generation</b></summary>

<br>

One of the larger changes in this fork is that pulled buddies can get an LLM-generated soul:

- a generated name
- a short personality description
- tone grounded in the buddy's stat profile rather than a generic template

By default this follows the configured host:

```bash
bun run settings host claude
bun run settings host codex
```

You can also override it per pull:

```bash
bun run pull -- --llm claude
bun run pull -- --llm codex
```

Current state of host support:

- `claude`: supported
- `codex`: only supported for pull soul generation

</details>

---

<details>
<summary><b>🏗️ &nbsp; How It Works</b></summary>

<br>

The installed runtime is still built around stable Claude Code extension points:

- MCP server
- `/buddy` skill
- status line integration
- post-tool and stop hooks

This fork also refactors the buddy internals so the system is easier to extend:

- pack-based species registry
- centralized hat rendering
- wallet and gacha state
- menagerie storage
- reaction/session isolation
- host-aware config

### Repository layout

```text
code-buddy/
├── server/          # MCP tools, engine, packs, reactions, wallet, state
├── cli/             # install, show, pick, pull, doctor, backup, settings
├── hooks/           # reaction + comment extraction hooks
├── statusline/      # buddy display for Claude Code
├── skills/buddy/    # /buddy slash-command routing
└── scripts/         # species tooling and generation helpers
```

</details>

---

<details>
<summary><b>🛠️ &nbsp; Commands Reference</b></summary>

<br>

### In Claude Code

| Command                     | Description                         |
| --------------------------- | ----------------------------------- |
| `/buddy`                    | Show the current buddy card         |
| `/buddy pet`                | Pet your companion                  |
| `/buddy stats`              | Show detailed stats                 |
| `/buddy pull`               | Spend coins to hatch a random buddy |
| `/buddy wallet`             | Show coin balance and pity progress |
| `/buddy gacha on/off`       | Toggle coin economy and pulls       |
| `/buddy packs`              | Show currently available packs      |
| `/buddy rename <name>`      | Rename current buddy                |
| `/buddy personality <text>` | Set custom personality              |
| `/buddy summon [slot]`      | Summon a saved buddy                |
| `/buddy save [slot]`        | Save current buddy                  |
| `/buddy list`               | List saved buddies                  |
| `/buddy dismiss <slot>`     | Remove a saved buddy slot           |
| `/buddy pick`               | Launch the interactive picker       |
| `/buddy off` / `/buddy on`  | Mute or unmute reactions            |
| `/buddy help`               | Show help                           |

### CLI

| Command                       | Description                                                 |
| ----------------------------- | ----------------------------------------------------------- | -------------------- |
| `bun run install-buddy`       | Install MCP, skill, hooks, and status line                  |
| `bun run show`                | Show current buddy in the terminal                          |
| `bun run pick`                | Interactive picker and browser for saved/searchable buddies |
| `bun run hunt`                | Legacy non-interactive search                               |
| `bun run pull`                | Animated gacha pull flow                                    |
| `bun run pull:claude`         | Pull using Claude for soul generation                       |
| `bun run pull:codex`          | Pull using Codex for soul generation                        |
| `bun run settings`            | Show current settings                                       |
| `bun run settings host claude | codex`                                                      | Set the default host |
| `bun run settings gacha on    | off`                                                        | Toggle gacha mode    |
| `bun run doctor`              | Run diagnostics                                             |
| `bun run backup`              | Backup or restore buddy state                               |
| `bun run upgrade`             | Pull latest changes and reinstall                           |
| `bun run uninstall`           | Remove the integration                                      |

</details>

---

<details>
<summary><b>🔍 &nbsp; Diagnostics and Troubleshooting</b></summary>

<br>

### `bun run doctor`

Use this first when something looks wrong. It collects environment info, state/config, and status line diagnostics.

### `bun run test-statusline`

Temporarily replaces the buddy status line with a diagnostic view so rendering problems are easier to debug.

### Common issues

- Buddy not appearing after install:
    - restart Claude Code completely
    - make sure `bun` and `jq` are on `PATH`
    - confirm the MCP entry and status line config were installed into the expected profile
- Comments not showing:
    - the buddy instructions are loaded at session start, so restart Claude Code after install or upgrade
- Art alignment looks off:
    - run `bun run doctor`
    - then `bun run test-statusline`

</details>

---

## Roadmap

- [x] Multi-buddy menagerie
- [x] Gacha mode, wallet, pity, and achievements
- [x] Pack-based species architecture
- [x] LLM-generated buddy souls for pulls
- [x] Initial host setting for future multi-host support
- [ ] Broader Codex CLI support beyond soul generation
- [ ] More packs and community-contributed species
- [ ] Leveling, memory, and mood systems
- [ ] One-command install flow without cloning

## Fork Notes

If you are looking for the original project and or just restore the claude code buddy experience only, start with:

- Upstream: [1270011/claude-buddy](https://github.com/1270011/claude-buddy)

If you want the more experimental branch of the idea with packs, pulls, and expanding host support, this fork is that branch.

## Contributing

Issues and PRs are welcome:

- Bugs and rendering fixes
- New species and pack ideas
- Better reactions and personality prompting
- Claude Code and Codex portability work

Open an issue or PR on [Luminous9/code-buddy](https://github.com/Luminous9/code-buddy).

## Credits

- Original buddy concept by Anthropic
- Original restore project by [1270011/claude-buddy](https://github.com/1270011/claude-buddy)
- Inspired by [any-buddy](https://github.com/cpaczek/any-buddy), [buddy-reroll](https://github.com/grayashh/buddy-reroll), and [ccbuddyy](https://github.com/vibenalytics/ccbuddyy)
- Built with the [Model Context Protocol](https://modelcontextprotocol.io)

<div align="center">

### License

MIT

</div>
