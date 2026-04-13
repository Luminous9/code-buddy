/**
 * Unit tests for pull.ts
 *
 * Tests the gacha pull algorithm: generation, pity system, and flavor text.
 * Uses pure functions — no disk I/O.
 */

import { describe, test, expect } from "bun:test";
import { pullBuddy, updatePity, hatchFlavorText, type PullResult } from "./pull.ts";
import { RARITIES, type Rarity } from "./engine.ts";
import type { WalletState } from "./wallet.ts";

function makeWallet(overrides: Partial<WalletState> = {}): WalletState {
  return {
    coins: 0,
    totalEarned: 0,
    totalSpent: 0,
    pullCount: 0,
    pityEpic: 0,
    pityLegendary: 0,
    ...overrides,
  };
}

// ─── pullBuddy ──────────────────────────────────────────────────────────────

describe("pullBuddy", () => {
  test("returns a valid BuddyBones with all required fields", () => {
    const result = pullBuddy(makeWallet());
    expect(result.bones).toBeDefined();
    expect(result.userId).toBeDefined();
    expect(typeof result.userId).toBe("string");
    expect(result.userId.length).toBe(32); // 16 bytes hex
    expect(RARITIES).toContain(result.bones.rarity);
    expect(typeof result.bones.shiny).toBe("boolean");
    expect(result.bones.stats).toBeDefined();
  });

  test("generates unique buddies across multiple pulls", () => {
    const w = makeWallet();
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const result = pullBuddy(w);
      ids.add(result.userId);
    }
    expect(ids.size).toBe(10);
  });

  test("normal pull is not pity-triggered", () => {
    const result = pullBuddy(makeWallet());
    expect(result.pityTriggered).toBe(false);
  });

  test("pull with pityEpic >= 50 triggers pity and returns epic+", () => {
    const w = makeWallet({ pityEpic: 50 });
    const result = pullBuddy(w);
    expect(result.pityTriggered).toBe(true);
    const rank = ["common", "uncommon", "rare", "epic", "legendary"].indexOf(result.bones.rarity);
    expect(rank).toBeGreaterThanOrEqual(3); // epic or legendary
  });

  test("pull with pityLegendary >= 100 triggers pity and returns legendary", () => {
    const w = makeWallet({ pityLegendary: 100 });
    const result = pullBuddy(w);
    expect(result.pityTriggered).toBe(true);
    expect(result.bones.rarity).toBe("legendary");
  });

  test("legendary pity takes precedence over epic pity", () => {
    const w = makeWallet({ pityEpic: 55, pityLegendary: 100 });
    const result = pullBuddy(w);
    expect(result.bones.rarity).toBe("legendary");
  });
});

// ─── updatePity ─────────────────────────────────────────────────────────────

describe("updatePity", () => {
  test("legendary pull resets both pity counters", () => {
    const w = makeWallet({ pityEpic: 30, pityLegendary: 80 });
    updatePity(w, "legendary");
    expect(w.pityEpic).toBe(0);
    expect(w.pityLegendary).toBe(0);
    expect(w.pullCount).toBe(1);
  });

  test("epic pull resets epic pity, increments legendary pity", () => {
    const w = makeWallet({ pityEpic: 30, pityLegendary: 80 });
    updatePity(w, "epic");
    expect(w.pityEpic).toBe(0);
    expect(w.pityLegendary).toBe(81);
    expect(w.pullCount).toBe(1);
  });

  test("rare pull increments both pity counters", () => {
    const w = makeWallet({ pityEpic: 10, pityLegendary: 20 });
    updatePity(w, "rare");
    expect(w.pityEpic).toBe(11);
    expect(w.pityLegendary).toBe(21);
  });

  test("common pull increments both pity counters", () => {
    const w = makeWallet({ pityEpic: 0, pityLegendary: 0 });
    updatePity(w, "common");
    expect(w.pityEpic).toBe(1);
    expect(w.pityLegendary).toBe(1);
  });

  test("uncommon pull increments both pity counters", () => {
    const w = makeWallet({ pityEpic: 5, pityLegendary: 5 });
    updatePity(w, "uncommon");
    expect(w.pityEpic).toBe(6);
    expect(w.pityLegendary).toBe(6);
  });

  test("pullCount increments on every pull regardless of rarity", () => {
    const w = makeWallet({ pullCount: 10 });
    updatePity(w, "common");
    expect(w.pullCount).toBe(11);
    updatePity(w, "legendary");
    expect(w.pullCount).toBe(12);
  });
});

// ─── hatchFlavorText ────────────────────────────────────────────────────────

describe("hatchFlavorText", () => {
  test("always starts with egg wobble and crack", () => {
    for (const rarity of RARITIES) {
      const text = hatchFlavorText(rarity, false);
      expect(text).toContain("wobbles");
      expect(text).toContain("crack");
    }
  });

  test("legendary mentions golden light", () => {
    const text = hatchFlavorText("legendary", false);
    expect(text).toContain("Golden light");
  });

  test("epic mentions purple energy", () => {
    const text = hatchFlavorText("epic", false);
    expect(text).toContain("Purple energy");
  });

  test("rare mentions blue glow", () => {
    const text = hatchFlavorText("rare", false);
    expect(text).toContain("blue glow");
  });

  test("uncommon mentions green shimmer", () => {
    const text = hatchFlavorText("uncommon", false);
    expect(text).toContain("green shimmer");
  });

  test("common mentions faint glow", () => {
    const text = hatchFlavorText("common", false);
    expect(text).toContain("faint glow");
  });

  test("shiny adds sparkle text", () => {
    const text = hatchFlavorText("common", true);
    expect(text).toContain("SPARKLES");
  });

  test("non-shiny does not mention sparkle", () => {
    const text = hatchFlavorText("legendary", false);
    expect(text).not.toContain("SPARKLES");
  });

  test("each line is a blockquote", () => {
    for (const rarity of RARITIES) {
      const text = hatchFlavorText(rarity, false);
      const lines = text.split("\n");
      for (const line of lines) {
        expect(line.startsWith("> ")).toBe(true);
      }
    }
  });
});

// ─── Rarity distribution sanity check ───────────────────────────────────────

describe("rarity distribution", () => {
  test("1000 pulls produce a reasonable distribution", () => {
    const counts: Record<string, number> = {};
    for (const r of RARITIES) counts[r] = 0;

    const w = makeWallet();
    for (let i = 0; i < 1000; i++) {
      const result = pullBuddy(w);
      counts[result.bones.rarity]++;
    }

    // Common should be the most frequent
    expect(counts["common"]).toBeGreaterThan(counts["uncommon"]);
    // Legendary should be rare
    expect(counts["legendary"]).toBeLessThan(50);
    // At least some uncommon
    expect(counts["uncommon"]).toBeGreaterThan(50);
  });
});
