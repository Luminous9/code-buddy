#!/usr/bin/env bun
/**
 * scripts/gen-shell-art.ts — generate shell species art case blocks from pack data
 *
 * Reads species art from packs.ts and patches the case blocks in:
 *   - statusline/buddy-status.sh
 *   - popup/buddy-render.sh
 *
 * Art lines 1-4 of each frame (line 0 is the hat slot, skipped).
 * {E} → ${E}, backticks escaped for bash.
 *
 * Usage: bun run gen-shell-art
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { getActiveSpeciesData, BARE_HATS, getHatOffset } from "../server/packs.ts";

const PROJECT_ROOT = resolve(dirname(import.meta.dir));

const BEGIN_MARKER = "# --- BEGIN GENERATED SPECIES ART ---";
const END_MARKER = "# --- END GENERATED SPECIES ART ---";
const HAT_BEGIN = "# --- BEGIN GENERATED HAT ART ---";
const HAT_END = "# --- END GENERATED HAT ART ---";

/** Escape a string for use in a bash double-quoted assignment. */
function bashEscape(s: string): string {
  // Trim trailing whitespace from art lines
  let escaped = s.trimEnd();
  // Escape backslashes first (before other escapes add more backslashes)
  escaped = escaped.replace(/\\/g, "\\\\");
  // Escape double quotes
  escaped = escaped.replace(/"/g, '\\"');
  // Escape backticks
  escaped = escaped.replace(/`/g, "\\`");
  // {E} → ${E} for bash variable interpolation (before $ escaping)
  escaped = escaped.replace(/\{E\}/g, "${E}");
  // Escape dollar signs EXCEPT ${E} which we just added
  escaped = escaped.replace(/\$(?!\{E\})/g, "\\$");
  return escaped;
}

interface ShellConfig {
  speciesVar: string;  // "$SPECIES"
  frameVar: string;    // "$FRAME"
  hatVar: string;      // "$HAT"
}

/** Generate case blocks for all active species. */
function generateCaseBlocks(cfg: ShellConfig): string {
  const species = getActiveSpeciesData();
  const lines: string[] = [];

  lines.push(`case "${cfg.speciesVar}" in`);

  for (const sp of species) {
    lines.push(`  ${sp.id})`);
    lines.push(`    case ${cfg.frameVar} in`);

    for (let f = 0; f < sp.art.length; f++) {
      const frame = sp.art[f];
      // Lines 1-4 (skip line 0 which is the hat slot)
      const l1 = bashEscape(frame[1] ?? "");
      const l2 = bashEscape(frame[2] ?? "");
      const l3 = bashEscape(frame[3] ?? "");
      const l4 = bashEscape(frame[4] ?? "");

      lines.push(`      ${f}) L1="${l1}"; L2="${l2}"; L3="${l3}"; L4="${l4}" ;;`);
    }

    lines.push(`    esac ;;`);
  }

  // Fallback for unknown species
  lines.push(`  *)`);
  lines.push(`    L1="(\${E}\${E})"; L2="(  )"; L3=""; L4="" ;;`);
  lines.push(`esac`);

  return lines.join("\n");
}

/** Patch a region between marker comments in a file. */
function patchRegion(content: string, beginMarker: string, endMarker: string, generated: string, filePath: string): string {
  const beginIdx = content.indexOf(beginMarker);
  const endIdx = content.indexOf(endMarker);

  if (beginIdx === -1 || endIdx === -1) {
    // Markers not found — skip this region silently
    return content;
  }

  const before = content.slice(0, beginIdx + beginMarker.length);
  const after = content.slice(endIdx);
  return before + "\n" + generated + "\n" + after;
}

/** Patch a shell file: species art + hat art. */
function patchFile(filePath: string, cfg: ShellConfig): void {
  let content = readFileSync(filePath, "utf8");

  // Patch species art
  const beginIdx = content.indexOf(BEGIN_MARKER);
  const endIdx = content.indexOf(END_MARKER);
  if (beginIdx === -1 || endIdx === -1) {
    console.error(`  \x1b[31m✗\x1b[0m  Species art markers not found in ${filePath}`);
    process.exit(1);
  }
  content = patchRegion(content, BEGIN_MARKER, END_MARKER, generateCaseBlocks(cfg), filePath);

  // Patch hat art (optional — only if markers exist)
  content = patchRegion(content, HAT_BEGIN, HAT_END, generateHatBlock(cfg), filePath);

  writeFileSync(filePath, content);
  console.log(`  \x1b[32m✓\x1b[0m  ${filePath}`);
}

/** Generate hat case block: bare hat strings + per-species centering logic. */
function generateHatBlock(cfg: ShellConfig): string {
  const species = getActiveSpeciesData();
  const lines: string[] = [];

  // First: bare hat strings
  lines.push(`BARE_HAT=""`);
  lines.push(`case "${cfg.hatVar}" in`);
  for (const [hat, bare] of Object.entries(BARE_HATS)) {
    if (hat === "none" || !bare) continue;
    lines.push(`  ${hat}) BARE_HAT="${bashEscape(bare)}" ;;`);
  }
  lines.push(`esac`);
  lines.push(``);

  // Second: per-species art width and hat offset per frame
  lines.push(`HAT_LINE=""`);
  lines.push(`if [ -n "$BARE_HAT" ]; then`);
  lines.push(`  ART_W=12`);
  lines.push(`  HAT_OFFSET=0`);
  lines.push(`  case "${cfg.speciesVar}" in`);

  for (const sp of species) {
    // Compute max art width across all lines of all frames (excluding line 0)
    // Compute max rendered width ({E} → single char)
    let maxW = 0;
    for (const frame of sp.art) {
      for (let i = 1; i < frame.length; i++) {
        maxW = Math.max(maxW, frame[i].replace(/\{E\}/g, ".").length);
      }
    }

    const offsets = [0, 1, 2].map(f => getHatOffset(sp.id, f));
    const hasOffset = offsets.some(o => o !== 0);

    if (hasOffset) {
      // Per-frame offsets
      const frameCases = offsets.map((o, f) =>
        `        ${f}) HAT_OFFSET=${o} ;;`
      ).join("\n");
      lines.push(`    ${sp.id}) ART_W=${maxW}`);
      lines.push(`      case ${cfg.frameVar} in`);
      lines.push(frameCases);
      lines.push(`      esac ;;`);
    } else {
      lines.push(`    ${sp.id}) ART_W=${maxW} ;;`);
    }
  }

  lines.push(`  esac`);
  lines.push(`  BARE_LEN=\${#BARE_HAT}`);
  lines.push(`  PAD=$(( (ART_W - BARE_LEN) / 2 + HAT_OFFSET ))`);
  lines.push(`  [ "$PAD" -lt 0 ] && PAD=0`);
  lines.push(`  HAT_LINE="$(printf '%*s%s' "$PAD" '' "$BARE_HAT")"`);
  lines.push(`fi`);

  return lines.join("\n");
}

// ─── Main ──────────────────────────────────────────────────────────────────

const SHELL_CFG: ShellConfig = { speciesVar: "$SPECIES", frameVar: "$FRAME", hatVar: "$HAT" };

const targets: Array<{ path: string; cfg: ShellConfig }> = [
  { path: resolve(PROJECT_ROOT, "statusline/buddy-status.sh"), cfg: SHELL_CFG },
  { path: resolve(PROJECT_ROOT, "popup/buddy-render.sh"), cfg: SHELL_CFG },
];

console.log("Generating shell species art from pack data...\n");

const speciesCount = getActiveSpeciesData().length;
console.log(`  ${speciesCount} species from active packs\n`);

for (const { path, cfg } of targets) {
  patchFile(path, cfg);
}

console.log("\n  Done!");
