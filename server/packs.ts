/**
 * Buddy pack system — themed collections of species
 *
 * Packs are the single source of truth for all species data:
 * art, face templates, and species-specific reactions.
 *
 * The core pack contains the original 18 species (always available).
 * Additional packs rotate weekly in gacha mode.
 * Dev packs (dev: true) are completely hidden from runtime.
 */

// Inline PRNG to avoid circular dependency with engine.ts
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type ReactionReason = "hatch" | "pet" | "error" | "test-fail" | "large-diff" | "turn" | "idle";

export interface PackSpecies {
  id: string;
  art: string[][];               // 3 frames × 5 lines each (line 0 = hat slot)
  face: string;                  // compact face template with {E}
  reactions?: Partial<Record<ReactionReason, string[]>>;
}

export interface Pack {
  id: string;
  name: string;
  icon: string;
  species: PackSpecies[];
  dev: boolean;
}

// ─── Pack registry ──────────────────────────────────────────────────────────

import { corePack } from "./packs/core.ts";
import { insectsPack } from "./packs/insects.ts";

export const PACKS: Pack[] = [
  corePack,
  insectsPack,
];

// ─── Queries ────────────────────────────────────────────────────────────────

/** All species IDs from non-dev packs (the full runtime pool). */
export function getActiveSpecies(): string[] {
  return PACKS
    .filter(p => !p.dev)
    .flatMap(p => p.species.map(s => s.id));
}

/** All species data from non-dev packs. */
export function getActiveSpeciesData(): PackSpecies[] {
  return PACKS
    .filter(p => !p.dev)
    .flatMap(p => p.species);
}

/** The core pack (always available). */
export function getCorePack(): Pack {
  return PACKS.find(p => p.id === "core")!;
}

/** Core species IDs only — used by generateBones for deterministic generation. */
export function getCoreSpecies(): string[] {
  return getCorePack().species.map(s => s.id);
}

/** Which pack does a species belong to? */
export function getPackForSpecies(speciesId: string): Pack | null {
  return PACKS.find(p => p.species.some(s => s.id === speciesId)) ?? null;
}

/** Species IDs belonging to a specific pack. */
export function getPackSpeciesIds(packId: string): string[] {
  const pack = PACKS.find(p => p.id === packId);
  if (!pack || pack.dev) return [];
  return pack.species.map(s => s.id);
}

// ─── Weekly rotation ────────────────────────────────────────────────────────

const EPOCH = new Date("2026-01-01T00:00:00Z").getTime();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** This week's featured extra pack (null if no non-core, non-dev packs). */
export function getCurrentRotationPack(): Pack | null {
  const extraPacks = PACKS.filter(p => p.id !== "core" && !p.dev);
  if (extraPacks.length === 0) return null;

  const weeksSinceEpoch = Math.floor((Date.now() - EPOCH) / WEEK_MS);
  const cycleLength = extraPacks.length;
  const cycleNumber = Math.floor(weeksSinceEpoch / cycleLength);
  const indexInCycle = weeksSinceEpoch % cycleLength;

  // Deterministic shuffle per cycle
  const shuffled = [...extraPacks];
  const rng = mulberry32(cycleNumber * 31337);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled[indexInCycle];
}

/** Packs available for gacha pulls right now: core + weekly rotation. */
export function getAvailablePacks(): Pack[] {
  const packs: Pack[] = [getCorePack()];
  const rotation = getCurrentRotationPack();
  if (rotation) packs.push(rotation);
  return packs;
}

/** Species IDs available for gacha pulls right now. */
export function getAvailablePullSpecies(packId?: string): string[] {
  if (packId) return getPackSpeciesIds(packId);
  return getAvailablePacks().flatMap(p => p.species.map(s => s.id));
}

// ─── Registry builders (for engine.ts, art.ts, reactions.ts) ────────────────

/** Build the SPECIES_ART record from active packs. */
export function buildSpeciesArt(): Record<string, string[][]> {
  const art: Record<string, string[][]> = {};
  for (const s of getActiveSpeciesData()) {
    art[s.id] = s.art;
  }
  return art;
}

/** Build the FACE_TEMPLATES record from active packs. */
export function buildFaceTemplates(): Record<string, string> {
  const faces: Record<string, string> = {};
  for (const s of getActiveSpeciesData()) {
    faces[s.id] = s.face;
  }
  return faces;
}

/** Build the SPECIES_REACTIONS record from active packs. */
export function buildSpeciesReactions(): Record<string, Partial<Record<ReactionReason, string[]>>> {
  const reactions: Record<string, Partial<Record<ReactionReason, string[]>>> = {};
  for (const s of getActiveSpeciesData()) {
    if (s.reactions) reactions[s.id] = s.reactions;
  }
  return reactions;
}
