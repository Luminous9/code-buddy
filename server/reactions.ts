/**
 * Reaction templates — species-aware buddy responses to events
 */

import type { Species, Rarity, StatName, BuddyStats } from "./engine.ts";
import { mulberry32, hashString, SALT } from "./engine.ts";
import type { BuddyBones } from "./engine.ts";
import { buildSpeciesReactions, type ReactionReason } from "./packs.ts";

interface ReactionPool {
  [key: string]: string[];
}

// General reactions by event type
const REACTIONS: Record<ReactionReason, string[]> = {
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
    "*adjusts glasses* line {line}, maybe?",
    "*slow blink* the stack trace told you everything.",
    "have you tried reading the error message?",
    "*winces*",
  ],
  "test-fail": [
    "*head rotates slowly* ...that test.",
    "bold of you to assume that would pass.",
    "*taps clipboard* {count} failed.",
    "the tests are trying to tell you something.",
    "*sips tea* interesting.",
    "*marks calendar* test regression day.",
  ],
  "large-diff": [
    "that's... a lot of changes.",
    "*counts lines* are you refactoring or rewriting?",
    "might want to split that PR.",
    "*nervous laughter* {lines} lines changed.",
    "bold move. let's see if CI agrees.",
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

// Species-specific flavor (built from pack data)
const SPECIES_REACTIONS: Record<string, Partial<Record<ReactionReason, string[]>>> = buildSpeciesReactions();

// Rarity affects reaction quality/length
const RARITY_BONUS: Partial<Record<Rarity, string[]>> = {
  legendary: [
    "*legendary aura intensifies*",
    "*sparkles knowingly*",
  ],
  epic: [
    "*epic presence noted*",
  ],
};

export function getReaction(
  reason: ReactionReason,
  species: Species,
  rarity: Rarity,
  context?: { line?: number; count?: number; lines?: number },
): string {
  // Try species-specific first
  const speciesPool = SPECIES_REACTIONS[species]?.[reason];
  const generalPool = REACTIONS[reason];

  // 50% chance of species-specific if available
  const pool = speciesPool && Math.random() < 0.5 ? speciesPool : generalPool;
  let reaction = pool[Math.floor(Math.random() * pool.length)];

  // Template substitution
  if (context?.line) reaction = reaction.replace("{line}", String(context.line));
  if (context?.count) reaction = reaction.replace("{count}", String(context.count));
  if (context?.lines) reaction = reaction.replace("{lines}", String(context.lines));

  return reaction;
}

// ─── Personality generation (fallback names when API unavailable) ────────────

const FALLBACK_NAMES = [
  "Crumpet", "Soup", "Pickle", "Biscuit", "Moth", "Gravy",
  "Nugget", "Sprocket", "Miso", "Waffle", "Pixel", "Ember",
  "Thimble", "Marble", "Sesame", "Cobalt", "Rusty", "Nimbus",
];

const VIBE_WORDS = [
  "thunder", "biscuit", "void", "accordion", "moss", "velvet", "rust",
  "pickle", "crumb", "whisper", "gravy", "frost", "ember", "soup",
  "marble", "thorn", "honey", "static", "copper", "dusk", "sprocket",
  "quartz", "soot", "plum", "flint", "oyster", "loom", "anvil",
  "cork", "bloom", "pebble", "vapor", "mirth", "glint", "cider",
];

export function generateFallbackName(): string {
  return FALLBACK_NAMES[Math.floor(Math.random() * FALLBACK_NAMES.length)];
}

export function generatePersonalityPrompt(
  species: Species,
  rarity: Rarity,
  stats: BuddyStats | Record<string, number>,
  shiny: boolean,
  seed?: number,
): string {
  const rng = seed != null ? mulberry32(seed) : Math.random;
  const vibes: string[] = [];
  for (let i = 0; i < 4; i++) {
    vibes.push(VIBE_WORDS[Math.floor(rng() * VIBE_WORDS.length)]);
  }

  const statStr = Object.entries(stats).map(([k, v]) => `${k}:${v}`).join(", ");

  return [
    "Generate a coding companion — a small creature that lives in a developer's terminal.",
    "Don't repeat yourself — every companion should feel distinct.",
    "",
    `Rarity: ${rarity.toUpperCase()}`,
    `Species: ${species}`,
    `Stats: ${statStr}`,
    `Inspiration words: ${vibes.join(", ")}`,
    shiny ? "SHINY variant — extra special." : "",
    "",
    "Return JSON: {\"name\": \"1-14 chars\", \"personality\": \"2-3 sentences describing behavior\"}",
  ].filter(Boolean).join("\n");
}

// ─── Inspiration seed — deterministic from userId, like claude-code's Roll ──

export function inspirationSeed(userId: string): number {
  const rng = mulberry32(hashString(userId + SALT));
  // Burn the same number of draws that generateBones consumes so the seed
  // sits at the same PRNG position as claude-code's inspirationSeed.
  // generateBones: rarity(1) + species(1) + eye(1) + hat(1) + shiny(1)
  //   + peak(1) + dump(1..N) + stats(5×1) = ~12 draws minimum.
  // Rather than mirror exact draw count (which varies), we hash a separate
  // salt so the seed is stable regardless of bones-generation changes.
  return Math.floor(mulberry32(hashString(userId + SALT + "-soul"))() * 1e9);
}

// ─── Personality block — appended to tool responses for LLM generation ──────

export function buildPersonalityBlock(
  bones: BuddyBones,
  currentName: string,
  seed: number,
  slot: string,
): string {
  const prompt = generatePersonalityPrompt(
    bones.species,
    bones.rarity,
    bones.stats,
    bones.shiny,
    seed,
  );
  return [
    "",
    "---",
    "**Personality Generation**",
    "",
    "This buddy hatched with a placeholder personality. Generate a unique one now.",
    "",
    "<personality-prompt>",
    prompt,
    "</personality-prompt>",
    "",
    `Call \`buddy_set_personality\` with the personality text (2-3 sentences) and slot="${slot}".`,
    `Then call \`buddy_rename\` with the generated name and slot="${slot}" (the current placeholder name is "${currentName}").`,
  ].join("\n");
}
