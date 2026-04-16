#!/usr/bin/env bun
/**
 * export-reactions.ts — Dump all reactions (generic + species-specific) to
 * $BUDDY_STATE_DIR/reactions.json so the shell hook can read them without
 * hardcoded case blocks.
 *
 * Run after: species import, species delete, install, or any pack change.
 *
 * Output format:
 * {
 *   "generic": { "error": ["..."], "success": ["..."], ... },
 *   "species": { "duck": { "error": ["..."], "success": ["..."] }, ... }
 * }
 */

import { writeFileSync, mkdirSync } from "fs";
import { buddyStateDir } from "../server/path.ts";
import { buildSpeciesReactions } from "../server/packs.ts";
import type { ReactionReason } from "../server/packs.ts";

// Generic reactions — mirrors the REACTIONS constant in reactions.ts
// Duplicated here so the export script doesn't import the full reactions module
// (which has side effects from buildSpeciesReactions at module scope).
const GENERIC: Record<ReactionReason, string[]> = {
  hatch: [
    "*blinks* ...where am I?",
    "*stretches* hello, world!",
    "*looks around curiously* nice terminal you got here.",
    "*yawns* ok I'm ready. show me the code.",
  ],
  pet: [
    "*purrs contentedly*",
    "*happy noises*",
    "*nuzzles your cursor*",
    "*wiggles*",
    "again! again!",
    "*closes eyes peacefully*",
  ],
  error: [
    "*head tilts* ...that doesn't look right.",
    "saw that one coming.",
    "*slow blink* the stack trace told you everything.",
    "have you tried reading the error message?",
    "*winces*",
  ],
  "test-fail": [
    "*head rotates slowly* ...that test.",
    "bold of you to assume that would pass.",
    "the tests are trying to tell you something.",
    "*sips tea* interesting.",
    "*marks calendar* test regression day.",
  ],
  "large-diff": [
    "that's... a lot of changes.",
    "might want to split that PR.",
    "bold move. let's see if CI agrees.",
    "*counts lines nervously*",
  ],
  turn: [
    "*watches quietly*",
    "*takes notes*",
    "*nods*",
    "...",
    "*adjusts hat*",
  ],
  idle: [
    "*dozes off*",
    "*doodles in margins*",
    "*stares at cursor blinking*",
    "zzz...",
  ],
  success: [
    "*nods*",
    "nice.",
    "*quiet approval*",
    "clean.",
  ],
};

const speciesReactions = buildSpeciesReactions();

const output = {
  generic: GENERIC,
  species: speciesReactions,
};

const dir = buddyStateDir();
mkdirSync(dir, { recursive: true });
const outPath = `${dir}/reactions.json`;
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Exported reactions to ${outPath}`);
