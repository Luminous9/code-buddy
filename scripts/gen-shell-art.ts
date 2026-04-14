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
import { getActiveSpeciesData } from "../server/packs.ts";

const PROJECT_ROOT = resolve(dirname(import.meta.dir));

const BEGIN_MARKER = "# --- BEGIN GENERATED SPECIES ART ---";
const END_MARKER = "# --- END GENERATED SPECIES ART ---";

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
  speciesVar: string;  // e.g. "$SPECIES" or "$species"
  frameVar: string;    // e.g. "$FRAME" or "$frame"
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

/** Patch a shell file between marker comments. */
function patchFile(filePath: string, cfg: ShellConfig): void {
  const content = readFileSync(filePath, "utf8");
  const beginIdx = content.indexOf(BEGIN_MARKER);
  const endIdx = content.indexOf(END_MARKER);

  if (beginIdx === -1 || endIdx === -1) {
    console.error(`  \x1b[31m✗\x1b[0m  Markers not found in ${filePath}`);
    console.error(`     Add these markers around the species case block:`);
    console.error(`     ${BEGIN_MARKER}`);
    console.error(`     ${END_MARKER}`);
    process.exit(1);
  }

  const before = content.slice(0, beginIdx + BEGIN_MARKER.length);
  const after = content.slice(endIdx);
  const generated = generateCaseBlocks(cfg);

  const newContent = before + "\n" + generated + "\n" + after;
  writeFileSync(filePath, newContent);
  console.log(`  \x1b[32m✓\x1b[0m  ${filePath}`);
}

// ─── Main ──────────────────────────────────────────────────────────────────

const targets: Array<{ path: string; cfg: ShellConfig }> = [
  {
    path: resolve(PROJECT_ROOT, "statusline/buddy-status.sh"),
    cfg: { speciesVar: "$SPECIES", frameVar: "$FRAME" },
  },
  {
    path: resolve(PROJECT_ROOT, "popup/buddy-render.sh"),
    cfg: { speciesVar: "$species", frameVar: "$frame" },
  },
];

console.log("Generating shell species art from pack data...\n");

const speciesCount = getActiveSpeciesData().length;
console.log(`  ${speciesCount} species from active packs\n`);

for (const { path, cfg } of targets) {
  patchFile(path, cfg);
}

console.log("\n  Done!");
