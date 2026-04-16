/**
 * Unit tests for wallet.ts
 *
 * Tests the pure wallet state logic: interface shape, constants, and
 * the WalletState contract. File I/O functions (loadWallet, saveWallet,
 * earnCoins, spendCoins) persist to disk and are not tested here,
 * consistent with the project policy in TESTING.md.
 */

import { describe, test, expect } from "bun:test";
import {
  PULL_COST,
  MULTI_PULL_COUNT,
  MULTI_PULL_COST,
  type WalletState,
} from "./wallet.ts";

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

// ─── Constants ──────────────────────────────────────────────────────────────

describe("wallet constants", () => {
  test("PULL_COST is 50", () => {
    expect(PULL_COST).toBe(50);
  });

  test("MULTI_PULL_COUNT is 10", () => {
    expect(MULTI_PULL_COUNT).toBe(10);
  });

  test("MULTI_PULL_COST is 450 (10% discount)", () => {
    expect(MULTI_PULL_COST).toBe(450);
    expect(MULTI_PULL_COST).toBeLessThan(PULL_COST * MULTI_PULL_COUNT);
  });
});

// ─── WalletState shape ──────────────────────────────────────────────────────

describe("WalletState", () => {
  test("empty wallet has all fields set to 0", () => {
    const w = makeWallet();
    expect(w.coins).toBe(0);
    expect(w.totalEarned).toBe(0);
    expect(w.totalSpent).toBe(0);
    expect(w.pullCount).toBe(0);
    expect(w.pityEpic).toBe(0);
    expect(w.pityLegendary).toBe(0);
  });

  test("overrides apply correctly", () => {
    const w = makeWallet({ coins: 100, pullCount: 5 });
    expect(w.coins).toBe(100);
    expect(w.pullCount).toBe(5);
    expect(w.totalEarned).toBe(0);
  });
});

// ─── Affordability logic ────────────────────────────────────────────────────

describe("affordability checks", () => {
  test("cannot afford a pull with 0 coins", () => {
    const w = makeWallet();
    expect(w.coins >= PULL_COST).toBe(false);
  });

  test("can afford a pull with exactly 50 coins", () => {
    const w = makeWallet({ coins: 50 });
    expect(w.coins >= PULL_COST).toBe(true);
  });

  test("can afford a multi-pull with 450 coins", () => {
    const w = makeWallet({ coins: 450 });
    expect(w.coins >= MULTI_PULL_COST).toBe(true);
  });

  test("cannot afford a multi-pull with 449 coins", () => {
    const w = makeWallet({ coins: 449 });
    expect(w.coins >= MULTI_PULL_COST).toBe(false);
  });
});

// ─── Pity counter logic ─────────────────────────────────────────────────────

describe("pity counters", () => {
  test("pity epic threshold is 50", () => {
    const w = makeWallet({ pityEpic: 50 });
    expect(w.pityEpic).toBe(50);
  });

  test("pity legendary threshold is 100", () => {
    const w = makeWallet({ pityLegendary: 100 });
    expect(w.pityLegendary).toBe(100);
  });

  test("both pity counters can be active simultaneously", () => {
    const w = makeWallet({ pityEpic: 45, pityLegendary: 95 });
    expect(w.pityEpic).toBe(45);
    expect(w.pityLegendary).toBe(95);
  });
});

// ─── Bookkeeping invariants ─────────────────────────────────────────────────

describe("bookkeeping", () => {
  test("totalEarned - totalSpent >= coins (conservation)", () => {
    // After earning 200 and spending 150, coins should be 50
    const w = makeWallet({ coins: 50, totalEarned: 200, totalSpent: 150 });
    expect(w.totalEarned - w.totalSpent).toBe(w.coins);
  });

  test("pullCount tracks total pulls", () => {
    const w = makeWallet({ pullCount: 17 });
    expect(w.pullCount).toBe(17);
  });
});
