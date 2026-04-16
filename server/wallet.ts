/**
 * Wallet — coin economy for gacha pulls
 *
 * Users earn coins through normal coding activity (turns, errors, tests, diffs,
 * sessions, active days, pets). Coins are spent on gacha pulls to collect buddies.
 *
 * Persistence: <buddy-state>/wallet.json (atomic tmp+rename writes).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "fs";
import { join } from "path";
import { buddyStateDir } from "./path.ts";
import { isGachaMode } from "./state.ts";

const STATE_DIR = buddyStateDir();
const WALLET_FILE = join(STATE_DIR, "wallet.json");

export const PULL_COST = 50;
export const MULTI_PULL_COUNT = 10;
export const MULTI_PULL_COST = 450; // 10% discount

export interface WalletState {
  coins: number;
  totalEarned: number;
  totalSpent: number;
  pullCount: number;
  pityEpic: number;      // consecutive pulls without epic+
  pityLegendary: number;  // consecutive pulls without legendary
}

const EMPTY_WALLET: WalletState = {
  coins: 0,
  totalEarned: 0,
  totalSpent: 0,
  pullCount: 0,
  pityEpic: 0,
  pityLegendary: 0,
};

function ensureDir(): void {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

function atomicWrite(path: string, data: string): void {
  ensureDir();
  const tmp = path + ".tmp";
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

export function loadWallet(): WalletState {
  try {
    const parsed = JSON.parse(readFileSync(WALLET_FILE, "utf8"));
    return { ...EMPTY_WALLET, ...parsed };
  } catch {
    return { ...EMPTY_WALLET };
  }
}

export function saveWallet(wallet: WalletState): void {
  atomicWrite(WALLET_FILE, JSON.stringify(wallet, null, 2));
}

export function initializeWallet(): WalletState {
  const wallet = loadWallet();
  saveWallet(wallet);
  return wallet;
}

export function earnCoins(amount: number): WalletState {
  if (!isGachaMode()) return loadWallet();
  const wallet = loadWallet();
  wallet.coins += amount;
  wallet.totalEarned += amount;
  saveWallet(wallet);
  return wallet;
}

export function spendCoins(amount: number): WalletState {
  const wallet = loadWallet();
  if (wallet.coins < amount) {
    throw new Error(`Not enough coins: have ${wallet.coins}, need ${amount}`);
  }
  wallet.coins -= amount;
  wallet.totalSpent += amount;
  saveWallet(wallet);
  return wallet;
}

export function canAfford(amount: number): boolean {
  return loadWallet().coins >= amount;
}
