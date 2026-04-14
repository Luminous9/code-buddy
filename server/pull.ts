/**
 * Gacha pull — random buddy generation with pity system
 *
 * Reuses generateBones() from engine.ts with a random userId for each pull.
 * Natural rarity odds are preserved; pity only kicks in after long dry streaks.
 */

import { randomBytes } from "crypto";
import { generateBones, SPECIES, type BuddyBones, type Rarity, RARITIES } from "./engine.ts";
import { type WalletState } from "./wallet.ts";
import { getAvailablePullSpecies } from "./packs.ts";

const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

const PITY_EPIC_THRESHOLD = 50;
const PITY_LEGENDARY_THRESHOLD = 100;

export interface PullResult {
  bones: BuddyBones;
  userId: string;
  pityTriggered: boolean;
}

/**
 * Pull a random buddy. If pity thresholds are met, rejection-sample
 * until the minimum rarity is reached. If packId is provided, only
 * accept species from that pack (rejection-sample).
 */
export function pullBuddy(wallet: WalletState, packId?: string): PullResult {
  let minRarity: Rarity | null = null;
  let pityTriggered = false;

  if (wallet.pityLegendary >= PITY_LEGENDARY_THRESHOLD) {
    minRarity = "legendary";
    pityTriggered = true;
  } else if (wallet.pityEpic >= PITY_EPIC_THRESHOLD) {
    minRarity = "epic";
    pityTriggered = true;
  }

  const allowedSpecies = new Set(getAvailablePullSpecies(packId));

  // More attempts needed for smaller packs or pity
  const baseAttempts = minRarity === "legendary" ? 5_000_000
    : minRarity === "epic" ? 2_000_000
    : 1;
  const maxAttempts = packId ? Math.max(baseAttempts, 500_000) : baseAttempts;

  for (let i = 0; i < maxAttempts; i++) {
    const userId = randomBytes(16).toString("hex");
    const bones = generateBones(userId, undefined, SPECIES);

    if (minRarity && RARITY_RANK[bones.rarity] < RARITY_RANK[minRarity]) {
      continue;
    }

    if (allowedSpecies.size > 0 && !allowedSpecies.has(bones.species)) {
      continue;
    }

    return { bones, userId, pityTriggered };
  }

  // Fallback — should never reach here with sufficient maxAttempts
  const userId = randomBytes(16).toString("hex");
  return { bones: generateBones(userId, undefined, SPECIES), userId, pityTriggered: false };
}

/**
 * Update pity counters after a pull. Returns updated wallet (not saved).
 */
export function updatePity(wallet: WalletState, rarity: Rarity): WalletState {
  const rank = RARITY_RANK[rarity];

  if (rank >= RARITY_RANK.legendary) {
    wallet.pityLegendary = 0;
    wallet.pityEpic = 0;
  } else if (rank >= RARITY_RANK.epic) {
    wallet.pityEpic = 0;
    wallet.pityLegendary += 1;
  } else {
    wallet.pityEpic += 1;
    wallet.pityLegendary += 1;
  }

  wallet.pullCount += 1;
  return wallet;
}

/**
 * Rarity-specific flavor text for the MCP text-based suspense reveal.
 */
export function hatchFlavorText(rarity: Rarity, shiny: boolean): string {
  const lines: string[] = [];
  lines.push("> *The egg wobbles...*");
  lines.push("> *A crack appears...*");

  switch (rarity) {
    case "legendary":
      lines.push("> *Golden light spills out...*");
      lines.push("> *The ground trembles...*");
      break;
    case "epic":
      lines.push("> *Purple energy crackles through the shell...*");
      break;
    case "rare":
      lines.push("> *A cool blue glow pulses from within...*");
      break;
    case "uncommon":
      lines.push("> *A soft green shimmer appears...*");
      break;
    case "common":
      lines.push("> *A faint glow emerges...*");
      break;
  }

  if (shiny) {
    lines.push("> *...and it SPARKLES!*");
  }

  return lines.join("\n");
}
