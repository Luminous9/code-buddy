#!/usr/bin/env bun
/**
 * scripts/species-tool.ts — helper for creating new species and packs
 *
 * Usage:
 *   bun run new-species [name]          Generate a markdown template in species-dev/
 *   bun run import-species <file>      Import a completed species template into a pack
 *   bun run delete-species <id>        Remove a species from its pack
 *   bun run preview-species <name>      Preview a species template from species-dev/
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "fs";
import { resolve, dirname, basename } from "path";
import { execSync } from "child_process";
import { renderHatLine } from "../server/packs.ts";

const PROJECT_ROOT = resolve(dirname(import.meta.dir));
const PACKS_DIR = resolve(PROJECT_ROOT, "server/packs");
const PACKS_INDEX = resolve(PROJECT_ROOT, "server/packs.ts");
const SPECIES_DEV_DIR = resolve(PROJECT_ROOT, "species-dev");

const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const NC = "\x1b[0m";

function ok(msg: string) { console.log(`${GREEN}✓${NC}  ${msg}`); }
function info(msg: string) { console.log(`${CYAN}→${NC}  ${msg}`); }
function warn(msg: string) { console.log(`${YELLOW}⚠${NC}  ${msg}`); }
function err(msg: string) { console.log(`${RED}✗${NC}  ${msg}`); }

// ─── Template generation ────────────────────────────────────────────────────

const TEMPLATE = `# New Species Design

Fill in the sections below, then run:
  bun run import-species <this-file.md>

## Species Info

- **id**: (lowercase, no spaces, e.g. "beetle")
- **face**: (compact 1-line face for status bar, use {E} for eyes, e.g. "<{E}={E}>")

## Pack

- **pack**: (existing pack id to add to, OR "new" to create a new pack)
- **pack_name**: (display name if creating new pack, e.g. "Insects")
- **pack_icon**: (emoji if creating new pack, e.g. "🐛")
- **dev**: true (set to false when ready to release)

## Art

Each frame is 5 lines. Line 1 is blank (hat slot). Lines 2-5 are the buddy.
Use {E} for eye placeholders. Each line should be ~12 chars wide.
Pad with spaces to keep alignment consistent.

### Frame 0 (idle)
\`\`\`





\`\`\`

### Frame 1 (variant)
\`\`\`





\`\`\`

### Frame 2 (variant)
\`\`\`





\`\`\`

## Hat Offset (optional)

Per-frame shift of hat position relative to center. 0 = centered.
Negative = left, positive = right. Leave blank for default (centered).

- Frame 0: 0
- Frame 1: 0
- Frame 2: 0

## Reactions (optional)

Species-specific reaction strings. Leave blank to use generic reactions.

### error
-

### pet
-

### idle
-

### success
-
`;

async function generateTemplate(name?: string): Promise<void> {
  if (!name) {
    process.stdout.write(`${CYAN}→${NC}  Species name: `);
    name = (await new Promise<string>((resolve) => {
      let buf = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk: string) => {
        buf += chunk;
        if (buf.includes("\n")) {
          process.stdin.pause();
          resolve(buf.trim());
        }
      });
      process.stdin.resume();
    }));
  }

  if (!name) {
    err("Species name is required.");
    process.exit(1);
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  mkdirSync(SPECIES_DEV_DIR, { recursive: true });
  const outPath = resolve(SPECIES_DEV_DIR, `${slug}-design.md`);
  writeFileSync(outPath, TEMPLATE);
  ok(`Template written to ${outPath}`);
  info("Fill in the template, then run:");
  console.log(`\n  bun run import-species ${outPath}\n`);
}

// ─── Template parsing ───────────────────────────────────────────────────────

interface ParsedSpecies {
  id: string;
  face: string;
  pack: string;
  packName?: string;
  packIcon?: string;
  dev: boolean;
  art: string[][];
  hatOffset: number[];
  reactions: Record<string, string[]>;
}

function parseTemplate(filePath: string): ParsedSpecies {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  // Parse key-value fields
  function getField(label: string): string {
    for (const line of lines) {
      const match = line.match(new RegExp(`\\*\\*${label}\\*\\*:\\s*(.+)`));
      if (match) return match[1].trim().replace(/^["']|["']$/g, "");
    }
    return "";
  }

  const id = getField("id");
  const face = getField("face");
  const pack = getField("pack");
  const packName = getField("pack_name");
  const packIcon = getField("pack_icon");
  const devStr = getField("dev");
  const dev = devStr === "true" || devStr === "";

  if (!id) throw new Error("Missing species id");
  if (!face) throw new Error("Missing face template");
  if (!pack) throw new Error("Missing pack id");

  // Parse art frames
  const art: string[][] = [];
  const frameRegex = /### Frame \d/g;
  let frameMatch;
  const framePositions: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (/^### Frame \d/.test(lines[i])) {
      framePositions.push(i);
    }
  }

  for (const pos of framePositions) {
    // Find the code block after this header
    let start = -1;
    let end = -1;
    for (let i = pos + 1; i < lines.length; i++) {
      if (lines[i].startsWith("```") && start === -1) {
        start = i + 1;
      } else if (lines[i].startsWith("```") && start !== -1) {
        end = i;
        break;
      }
    }
    if (start !== -1 && end !== -1) {
      const frameLines = lines.slice(start, end);
      // Ensure exactly 5 lines
      while (frameLines.length < 5) frameLines.push("            ");
      art.push(frameLines.slice(0, 5));
    }
  }

  if (art.length === 0) throw new Error("No art frames found");
  while (art.length < 3) art.push([...art[0]]); // duplicate frame 0 if needed

  // Parse hat offsets
  const hatOffset: number[] = [0, 0, 0];
  for (const line of lines) {
    const offsetMatch = line.match(/Frame (\d):\s*(-?\d+)/);
    if (offsetMatch) {
      const idx = parseInt(offsetMatch[1]);
      if (idx >= 0 && idx < 3) hatOffset[idx] = parseInt(offsetMatch[2]);
    }
  }

  // Parse reactions
  const reactions: Record<string, string[]> = {};
  const reactionTypes = ["error", "pet", "idle", "hatch", "test-fail", "large-diff", "turn", "success"];
  let currentReaction = "";

  for (const line of lines) {
    for (const rt of reactionTypes) {
      if (line.match(new RegExp(`^### ${rt}`, "i"))) {
        currentReaction = rt;
        reactions[rt] = [];
      }
    }
    if (currentReaction && line.startsWith("- ") && line.length > 2) {
      reactions[currentReaction].push(line.slice(2).trim());
    }
  }

  // Clean empty reaction arrays
  for (const key of Object.keys(reactions)) {
    if (reactions[key].length === 0) delete reactions[key];
  }

  return { id, face, pack, packName, packIcon, dev, art, hatOffset, reactions };
}

// ─── Import into pack ───────────────────────────────────────────────────────

function importSpecies(filePath: string): void {
  info(`Parsing ${filePath}...`);
  const spec = parseTemplate(filePath);

  console.log(`\n  Species: ${BOLD}${spec.id}${NC}`);
  console.log(`  Face:    ${spec.face}`);
  console.log(`  Pack:    ${spec.pack}`);
  console.log(`  Dev:     ${spec.dev}`);
  console.log(`  Frames:  ${spec.art.length}`);
  console.log(`  Hat off: [${spec.hatOffset.join(", ")}]`);
  const rxCount = Object.values(spec.reactions).reduce((a, b) => a + b.length, 0);
  console.log(`  Reacts:  ${rxCount} custom reactions`);
  console.log("");

  // Build the species TypeScript object
  const artStr = spec.art.map(frame =>
    `        [${frame.map(l => JSON.stringify(l)).join(", ")}]`
  ).join(",\n");

  const hasOffset = spec.hatOffset.some(o => o !== 0);
  const offsetStr = hasOffset ? `\n      hatOffset: [${spec.hatOffset.join(", ")}],` : "";

  let reactStr = "";
  if (Object.keys(spec.reactions).length > 0) {
    const entries = Object.entries(spec.reactions).map(([key, vals]) => {
      const quoted = vals.map(v => JSON.stringify(v)).join(", ");
      return `        "${key}": [${quoted}]`;
    }).join(",\n");
    reactStr = `\n      reactions: {\n${entries},\n      },`;
  }

  const speciesBlock = `    {
      id: ${JSON.stringify(spec.id)},
      face: ${JSON.stringify(spec.face)},
      art: [
${artStr},
      ],${offsetStr}${reactStr}
    }`;

  if (spec.pack === "new") {
    // Create a new pack file
    if (!spec.packName) throw new Error("pack_name required when creating a new pack");
    const packId = spec.packName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const packFile = resolve(PACKS_DIR, `${packId}.ts`);
    const varName = packId.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + "Pack";

    const packContent = `/**
 * ${spec.packName} pack
 */

import type { Pack } from "../packs.ts";

export const ${varName}: Pack = {
  id: ${JSON.stringify(packId)},
  name: ${JSON.stringify(spec.packName)},
  icon: ${JSON.stringify(spec.packIcon || "📦")},
  dev: ${spec.dev},
  species: [
${speciesBlock},
  ],
};
`;

    writeFileSync(packFile, packContent);
    ok(`Created pack file: ${packFile}`);

    // Register in packs.ts
    const packsContent = readFileSync(PACKS_INDEX, "utf8");

    const importLine = `import { ${varName} } from "./packs/${packId}.ts";`;
    const newImports = packsContent.replace(
      /(import \{ \w+Pack \} from "\.\/packs\/\w+\.ts";)\n(\nexport const PACKS)/,
      `$1\n${importLine}\n$2`
    );

    const newPacks = newImports.replace(
      /(export const PACKS: Pack\[\] = \[[\s\S]*?)(];)/,
      `$1  ${varName},\n$2`
    );

    writeFileSync(PACKS_INDEX, newPacks);
    ok("Registered pack in packs.ts");
  } else {
    // Add to existing pack
    const packFiles = existsSync(PACKS_DIR) ?
      require("fs").readdirSync(PACKS_DIR).filter((f: string) => f.endsWith(".ts")) : [];

    let targetFile = "";
    for (const f of packFiles) {
      const content = readFileSync(resolve(PACKS_DIR, f), "utf8");
      if (content.includes(`id: ${JSON.stringify(spec.pack)}`)) {
        targetFile = resolve(PACKS_DIR, f);
        break;
      }
    }

    if (!targetFile) throw new Error(`Pack "${spec.pack}" not found in ${PACKS_DIR}`);

    const content = readFileSync(targetFile, "utf8");

    // Insert before the closing of the species array
    const newContent = content.replace(
      /(\s*)(],\s*\n};)/,
      `$1${speciesBlock},\n  $2`
    );

    writeFileSync(targetFile, newContent);
    ok(`Added species to ${targetFile}`);
  }

  // Run gen-shell-art
  info("Regenerating shell art...");
  try {
    execSync("bun run gen-shell-art", { cwd: PROJECT_ROOT, stdio: "inherit" });
  } catch {
    warn("gen-shell-art failed — run manually: bun run gen-shell-art");
  }

  // Export reactions.json for the shell hook
  info("Exporting reactions...");
  try {
    execSync("bun run export-reactions", { cwd: PROJECT_ROOT, stdio: "inherit" });
  } catch {
    warn("export-reactions failed — run manually: bun run export-reactions");
  }

  console.log(`\n${GREEN}${BOLD}Done!${NC} Species "${spec.id}" added to pack "${spec.pack}".`);
  if (spec.dev) {
    console.log(`${DIM}Pack is in dev mode — set dev: false in the pack file to release.${NC}`);
  }
}

// ─── Delete species ─────────────────────────────────────────────────────────

function deleteSpecies(speciesId: string): void {
  info(`Looking for species "${speciesId}"...`);

  const packFiles = readdirSync(PACKS_DIR).filter(f => f.endsWith(".ts"));
  let found = false;

  for (const f of packFiles) {
    const filePath = resolve(PACKS_DIR, f);
    const content = readFileSync(filePath, "utf8");

    if (!content.includes(`id: ${JSON.stringify(speciesId)}`)) continue;

    // Find the species block and remove it
    // Match the { id: "speciesId", ... }, block including the trailing comma
    const regex = new RegExp(
      `\\s*\\{\\s*\\n\\s*id: ${JSON.stringify(speciesId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},[\\s\\S]*?\\},?`,
      "m"
    );

    const newContent = content.replace(regex, "");

    if (newContent === content) {
      err(`Found species in ${f} but could not parse the block for removal.`);
      err("Please remove it manually from the pack file.");
      process.exit(1);
    }

    writeFileSync(filePath, newContent);
    ok(`Removed "${speciesId}" from ${f}`);
    found = true;

    // Check if pack is now empty
    if (!newContent.includes("id: \"")) {
      warn(`Pack file ${f} may now be empty. Consider deleting it and removing from packs.ts.`);
    }
    break;
  }

  if (!found) {
    err(`Species "${speciesId}" not found in any pack file.`);
    process.exit(1);
  }

  // Regenerate shell art
  info("Regenerating shell art...");
  try {
    execSync("bun run gen-shell-art", { cwd: PROJECT_ROOT, stdio: "inherit" });
  } catch {
    warn("gen-shell-art failed — run manually: bun run gen-shell-art");
  }

  // Export reactions.json for the shell hook
  info("Exporting reactions...");
  try {
    execSync("bun run export-reactions", { cwd: PROJECT_ROOT, stdio: "inherit" });
  } catch {
    warn("export-reactions failed — run manually: bun run export-reactions");
  }

  console.log(`\n${GREEN}${BOLD}Done!${NC} Species "${speciesId}" removed.`);
}

// ─── Preview species ────────────────────────────────────────────────────────

function previewSpecies(fileArg: string): void {
  // Resolve the template file — accept a path or a species name (looks in species-dev/)
  let filePath = resolve(process.cwd(), fileArg);
  if (!existsSync(filePath)) {
    // Try as a species name in species-dev/
    const slug = fileArg.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    filePath = resolve(SPECIES_DEV_DIR, `${slug}-design.md`);
  }
  if (!existsSync(filePath)) {
    err(`Template not found: "${fileArg}"`);
    // List available templates in species-dev/
    if (existsSync(SPECIES_DEV_DIR)) {
      const templates = readdirSync(SPECIES_DEV_DIR).filter(f => f.endsWith("-design.md"));
      if (templates.length > 0) {
        info("Available templates in species-dev/:");
        for (const t of templates) {
          console.log(`    ${t.replace(/-design\.md$/, "")}`);
        }
      }
    }
    process.exit(1);
  }

  info(`Parsing ${filePath}...`);
  const species = parseTemplate(filePath);
  const eye = "·"; // default eye for preview

  console.log(`\n  ${BOLD}${species.id}${NC} — ${species.pack} pack`);
  console.log(`  Face: ${species.face.replace(/\{E\}/g, eye)}`);
  if (species.hatOffset.some(o => o !== 0)) {
    console.log(`  Hat offset: [${species.hatOffset.join(", ")}]`);
  }
  console.log("");

  // Show all frames side by side (static view)
  const labels = species.art.map((_, i) => `Frame ${i}:`);
  const maxLen = Math.max(...species.art.flat().map(l => l.replace(/\{E\}/g, eye).length));
  const colWidth = Math.max(maxLen + 1, 18);

  console.log("  " + labels.map(l => l.padEnd(colWidth)).join("  "));
  for (let line = 0; line < 5; line++) {
    const parts = species.art.map(frame => {
      const raw = frame[line] ?? "";
      return raw.replace(/\{E\}/g, eye);
    });
    console.log("  " + parts.map(p => p.padEnd(colWidth)).join("  "));
  }

  // Show hat preview
  console.log("");
  console.log(`  ${DIM}Hat preview (crown):${NC}`);
  for (let f = 0; f < species.art.length; f++) {
    const line0 = species.art[f][0]?.replace(/\{E\}/g, eye) ?? "";
    if (line0.trim()) {
      console.log(`  F${f}: ${line0}`);
    } else {
      const hatLine = renderHatLine("crown", species.id, f);
      console.log(`  F${f}: ${hatLine || ""}`);
    }
    for (let i = 1; i <= 2; i++) {
      const artLine = species.art[f][i]?.replace(/\{E\}/g, eye) ?? "";
      console.log(`      ${artLine}`);
    }
    console.log("");
  }

  // Show reactions
  if (Object.keys(species.reactions).length > 0) {
    console.log(`  ${DIM}Reactions:${NC}`);
    for (const [reason, lines] of Object.entries(species.reactions)) {
      console.log(`    ${reason}: ${lines.join(" / ")}`);
    }
  }

  // Animated preview
  console.log("");
  info("Animated preview (Ctrl-C to stop):\n");

  process.stdout.write("\x1b[?25l"); // hide cursor

  const cleanup = () => {
    process.stdout.write("\x1b[?25h"); // show cursor
    process.exit(0);
  };
  process.on("SIGINT", cleanup);

  const drawHeight = 5; // 5 art lines (lines 0-4), no hat
  const animSequence = [0, 1, 0, 2]; // frame 1 -> 2 -> 1 -> 3 (1-indexed)
  let seqIdx = 0;

  // Print initial blank lines to reserve space
  for (let i = 0; i < drawHeight; i++) console.log("");

  const interval = setInterval(() => {
    const artIdx = animSequence[seqIdx % animSequence.length];
    const frame = species.art[artIdx % species.art.length];

    // Move cursor up to overwrite
    process.stdout.write(`\x1b[${drawHeight}A`);

    // All 5 art lines, no hat
    for (let i = 0; i < frame.length; i++) {
      const rendered = frame[i].replace(/\{E\}/g, eye);
      process.stdout.write(`  ${CYAN}${rendered}${NC}\x1b[K\n`);
    }

    seqIdx++;
  }, 500);

  // Run for 30 seconds then stop
  setTimeout(() => {
    clearInterval(interval);
    console.log(`\n  ${DIM}(preview ended)${NC}`);
    cleanup();
  }, 30000);
}

// ─── Main ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];
const arg = args[1];

if (!command || command === "new" || command === "template") {
  await generateTemplate(arg);
} else if (command === "delete") {
  if (!arg) {
    err("Usage: bun run delete-species <species-id>");
    process.exit(1);
  }
  deleteSpecies(arg);
} else if (command === "preview") {
  if (!arg) {
    err("Usage: bun run preview-species <name-or-path>");
    info("Pass a species name (looks in species-dev/) or a path to a template file.");
    process.exit(1);
  }
  previewSpecies(arg);
} else {
  // Treat the argument as a file path for import
  const filePath = resolve(process.cwd(), command);
  if (!existsSync(filePath)) {
    err(`File not found: ${filePath}`);
    process.exit(1);
  }
  importSpecies(filePath);
}
