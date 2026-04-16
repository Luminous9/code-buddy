# Contributing to code-buddy

Thanks for wanting to help bring buddies back to life!

New to open source? Don't worry — this guide walks you through everything
you need: setup, DCO sign-off, tests, and what happens when you open a PR.

## Quick Setup

```bash
git clone https://github.com/Luminous9/code-buddy.git
cd code-buddy
bun install
bun run install-buddy
```

Restart Claude Code and type `/buddy` to verify everything works.

## Project Structure

| Directory       | What it does                                                                |
| --------------- | --------------------------------------------------------------------------- |
| `server/`       | MCP server, buddy engine, state, wallet, pull logic, reactions              |
| `server/packs/` | Source of truth for pack/species art, faces, and species-specific reactions |
| `skills/`       | `/buddy` slash command (SKILL.md)                                           |
| `hooks/`        | Shell scripts for error detection + comment extraction                      |
| `statusline/`   | Animated buddy display (Claude Code status line)                            |
| `cli/`          | Install, uninstall, show, pick, pull, settings, verify, diagnostics         |
| `scripts/`      | Species import/generation helpers and export utilities                      |
| `species-dev/`  | Markdown design templates for new species before import                     |

## Before opening a PR — quick checklist

- [ ] `bun install` ran clean
- [ ] `bun test` is green locally (all tests pass)
- [ ] Every commit is signed off with DCO (`git commit -s`)
- [ ] Commit messages are in English and prefixed (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `refactor:`, `test:`)
- [ ] Branch pushed to your fork, PR opened against `main`
- [ ] CI is green on the PR
- [ ] You understand that PRs are maintainer-reviewed before merge and are not self-merged by contributors

If any of these feel unclear, the sections below explain them step by step.

## How to Contribute

### Bug Fixes

1. Open an issue describing the bug
2. Fork the repo and create a branch (`fix/description`)
3. Fix it, test it locally
4. Open a PR

### New Features

1. Open an issue first to discuss the idea
2. Fork and branch (`feat/description`)
3. Keep the scope tight — small, reviewable PRs are better than broad refactors
4. Open a PR

### New Species Art

Species art now lives in pack files under `server/packs/*.ts`, not directly in `server/art.ts`.

Recommended workflow:

1. Create a template:

```bash
bun run new-species <name>
```

2. Fill out the generated markdown file in `species-dev/`.

3. Import it into an existing pack or a new pack:

```bash
bun run import-species species-dev/<name>-design.md
```

The import tool will:

- add the species to the selected pack in `server/packs/`
- create a new pack file if you chose `pack: new`
- regenerate shell art via `bun run gen-shell-art`
- export reactions for shell consumers via `bun run export-reactions`

Current art conventions:

- 3 animation frames
- 5 lines per frame
- line 1 is the hat slot
- use `{E}` for eye placeholders
- pad lines with spaces to keep widths stable

If you are editing a species by hand instead of using the template flow, the pack file is still the source of truth. Generated shell output should be refreshed afterward with:

```bash
bun run gen-shell-art
bun run export-reactions
```

### New Reactions

Generic reaction pools live in `server/reactions.ts`.

Species-specific reactions now live alongside each species definition inside `server/packs/*.ts`, under that species's `reactions` field.

In practice:

- edit `server/reactions.ts` when you want to change shared/default reaction tone
- edit `server/packs/*.ts` when you want a species to have custom flavor
- run `bun run export-reactions` after reaction changes if you are touching shell-consumed reaction data directly

If you are adding a new species through the template/import flow, species-specific reactions can be written directly in the design template and the import step will carry them into the pack for you.

## DCO (Developer Certificate of Origin)

Every commit to this repo must be **signed off** with the Developer
Certificate of Origin. This is a lightweight affirmation that you wrote
the code, or have the right to contribute it. It's a single line appended
to each commit message — no GPG keys, no certificates.

If any commit on your PR is missing the sign-off, the **DCO check** goes
red and the PR cannot be merged.

### How to sign off

Pass the `-s` flag to `git commit`:

```bash
git commit -s -m "feat: add sparkle particles to shiny buddies"
```

That appends a line like this to the commit message:

```
Signed-off-by: Your Name <your.email@example.com>
```

The name and email come from your local `git config user.name` and
`git config user.email`.

### Make sign-off automatic (recommended)

So you never forget, set up a short git alias once:

```bash
git config --global alias.ci "commit -s"
```

From now on, use `git ci -m "..."` instead of `git commit -m "..."` and
every commit will be signed off automatically.

Alternatively, if you only want sign-off to apply inside this repo (not
globally), drop the `--global` flag and run the command from the repo
directory.

### I forgot to sign off — how do I fix it?

**If it's only the last commit:**

```bash
git commit --amend --no-edit -s
git push --force-with-lease
```

`--force-with-lease` is the safe variant of `--force`: it refuses to
overwrite remote changes you haven't seen yet.

**If it's several commits:**

```bash
git rebase --signoff HEAD~N     # replace N with how many commits back
git push --force-with-lease
```

For example, `git rebase --signoff HEAD~3` re-signs the last three
commits.

## Automated tests

Run the full test suite with:

```bash
bun test
```

All tests must pass before a PR can be merged — this is enforced by CI.
Run it locally before pushing to catch failures early.

For a full breakdown of what's covered, what isn't, and why, see
[TESTING.md](./TESTING.md).

### Where the tests live

Tests live next to the code they cover:

- `server/engine.test.ts` — pure-function tests for the companion
  generator (`generateBones`, `hashString`, `mulberry32`, `renderFace`,
  `renderCompact`)
- `server/state.test.ts` — pure helper tests (`slugify`)
- `server/reactions.test.ts` — reactions, fallback names, and personality
  prompt (`getReaction`, `generateFallbackName`, `generatePersonalityPrompt`)
- `server/pull.test.ts` — gacha pull odds, pity logic, and hatch flavor text
- `server/wallet.test.ts` — wallet state and pull affordability
- `server/achievements.test.ts` — achievement thresholds and slot/global event behavior
- `server/path.test.ts` / `server/paths_sh.test.ts` — config/state path resolution
- `server/manifest.test.ts` / `server/uninstall.test.ts` — plugin manifest and cleanup regressions

### Adding new tests

If you add new pure logic, please add a test for it. File-I/O, MCP
protocol handling, and shell-script code don't need tests in this repo
for now — those are exercised manually and via the CLI commands below.

Use the built-in [`bun:test`](https://bun.sh/docs/cli/test) runner
(Jest-compatible `describe` / `test` / `expect`), no extra dependencies
needed:

```ts
import { describe, test, expect } from "bun:test"
import { mulberry32 } from "./engine.ts"

describe("mulberry32", () => {
    test("is deterministic", () => {
        const a = mulberry32(42)
        const b = mulberry32(42)
        expect(a()).toBe(b())
    })
})
```

## What happens when you open a PR

When you push a branch and open a PR against `main`, two checks run
automatically:

| Check                 | What it verifies                                              |
| --------------------- | ------------------------------------------------------------- |
| **Test (Bun latest)** | Runs `bun test` on Ubuntu with the latest Bun. Must be green. |
| **DCO**               | Verifies every commit has a `Signed-off-by:` line.            |

Both are required, and the repo also uses a maintainer-review merge flow.

### Current merge policy

Pull requests into `main` are expected to be reviewed by the project maintainer before merge.

In practice, that means a healthy PR usually looks like:

1. Open the PR against `main`.
2. Wait for CI to finish.
3. Address review feedback if any.
4. Wait for maintainer approval / merge.

If a check fails:

1. Click the check name on the PR to open the full log.
2. Fix the issue locally.
3. Commit and push again — CI re-runs automatically. No need to close or
   reopen the PR.

## Manual testing

These are the sanity checks to run by hand while developing:

```bash
# Verify buddy generation
bun run cli/verify.ts

# Show current buddy
bun run show

# Check current settings / host / gacha mode
bun run settings

# Try the gacha flow
bun run pull

# Preview a species template before import
bun run preview-species species-dev/<name>-design.md

# Test MCP server
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | bun server/index.ts

# Test status line
echo '{}' | ./statusline/buddy-status.sh
```

## Code Style

- TypeScript for server/CLI code
- Bash for hooks and status line (keep it POSIX-friendly where possible)
- No unnecessary dependencies
- If it can be simple, keep it simple
- Pack files in `server/packs/` are the canonical home for species art, face templates, hat offsets, and species-specific reactions

### Commit messages

- Written in **English**
- Short subject line (50-72 characters), prefixed with the change type:
    - `feat:` — a new user-visible feature
    - `fix:` — a bug fix
    - `chore:` — housekeeping (deps, repo config, no behavior change)
    - `docs:` — documentation only
    - `refactor:` — code restructure without behavior change
    - `test:` — adding or updating tests
    - `ci:` — CI / workflow changes
- Body (optional) explains the **why**, not the _what_ — the diff already
  shows the _what_
- Always signed off (see the DCO section above)

Example:

```
feat: add sparkle particles to shiny buddies

Shiny buddies are rare enough that they deserve a bit of visual flair.
This adds a three-frame sparkle animation that renders next to the
buddy face in the status line.

Signed-off-by: Your Name <your.email@example.com>
```

## Questions?

Open an issue. No question is too small.
