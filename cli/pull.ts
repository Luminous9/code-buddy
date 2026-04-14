#!/usr/bin/env bun
/**
 * cli/pull.ts — gacha pull with egg hatch animation
 *
 * Phases: confirm → egg → wobble → crack → reveal → card → decide → naming
 *
 * Keys:
 *   confirm:  [enter] pull  [q] quit
 *   decide:   [k] keep  [d] discard
 *   naming:   type name  [enter] save  [esc] cancel → discard
 */

import {
  loadActiveSlot, saveActiveSlot, saveCompanionSlot,
  slugify, unusedName, writeStatusState, loadCompanionSlot,
  isGachaMode,
} from "../server/state.ts";
import {
  generateBones, RARITIES, RARITY_STARS,
  type BuddyBones, type Rarity, type Companion,
} from "../server/engine.ts";
import { renderCompanionCard } from "../server/art.ts";
import { SPECIES_ART } from "../server/art.ts";
import {
  loadWallet, saveWallet, canAfford,
  PULL_COST, MULTI_PULL_COUNT, MULTI_PULL_COST,
  type WalletState,
} from "../server/wallet.ts";
import { pullBuddy, updatePity } from "../server/pull.ts";
import { incrementEvent, checkAndAward } from "../server/achievements.ts";
import { saveReaction } from "../server/state.ts";
import { getAvailablePacks, type Pack } from "../server/packs.ts";

// ─── ANSI ─────────────────────────────────────────────────────────────────────

const RARITY_CLR: Record<string, string> = {
  common:    "\x1b[38;2;153;153;153m",
  uncommon:  "\x1b[38;2;78;186;101m",
  rare:      "\x1b[38;2;177;185;249m",
  epic:      "\x1b[38;2;175;135;255m",
  legendary: "\x1b[38;2;255;193;7m",
};
const B  = "\x1b[1m";
const D  = "\x1b[2m";
const RV = "\x1b[7m";
const N  = "\x1b[0m";
const CY = "\x1b[36m";
const GR = "\x1b[90m";
const YL = "\x1b[33m";
const GN = "\x1b[32m";
const RD = "\x1b[31m";
const WH = "\x1b[37m";
const SHINY = "\x1b[93m"; // bright yellow

function stripAnsi(s: string): string { return s.replace(/\x1b\[[^m]*m/g, ""); }

function charWidth(cp: number): number {
  if (cp >= 0xFE00 && cp <= 0xFE0F) return 0;
  if (cp === 0x200D) return 0;
  if (cp >= 0x1F000) return 2;
  if (cp === 0x2728) return 2;
  if (cp >= 0x2600 && cp <= 0x27BF) return 1;
  if (cp >= 0x2500 && cp <= 0x257F) return 1;
  if (cp >= 0x2580 && cp <= 0x259F) return 1;
  if (cp >= 0x3000 && cp <= 0x9FFF) return 2;
  if (cp >= 0xF900 && cp <= 0xFAFF) return 2;
  if (cp >= 0xFF01 && cp <= 0xFF60) return 2;
  return 1;
}

function vlen(s: string): number {
  const clean = stripAnsi(s);
  let w = 0;
  for (const ch of clean) w += charWidth(ch.codePointAt(0)!);
  return w;
}

function center(s: string, w: number): string {
  const v = vlen(s);
  if (v >= w) return s;
  const left = Math.floor((w - v) / 2);
  return " ".repeat(left) + s + " ".repeat(w - v - left);
}

// ─── Egg ASCII art frames ────────────────────────────────────────────────────

const EGG_INTACT = [
  "      ___      ",
  "     /   \\     ",
  "    |  ?  |    ",
  "    |     |    ",
  "     \\___/     ",
];

const EGG_WOBBLE_LEFT = [
  "     ___       ",
  "    /   \\      ",
  "   |  ?  |     ",
  "   |     |     ",
  "    \\___/      ",
];

const EGG_WOBBLE_RIGHT = [
  "       ___     ",
  "      /   \\    ",
  "     |  ?  |   ",
  "     |     |   ",
  "      \\___/    ",
];

const EGG_CRACK_1 = [
  "      ___      ",
  "     / | \\     ",
  "    | /   |    ",
  "    |  \\  |    ",
  "     \\___/     ",
];

const EGG_CRACK_2 = [
  "      _*_      ",
  "     /| |\\     ",
  "    |/ * \\|    ",
  "    |\\   /|    ",
  "     \\*_*/     ",
];

const EGG_CRACK_3 = [
  "     \\ | /     ",
  "    --   --    ",
  "   |       |   ",
  "    --   --    ",
  "     / | \\     ",
];

const EGG_OPEN = [
  "   \\     /     ",
  "    \\   /      ",
  "               ",
  "    /   \\      ",
  "   / \\_/ \\     ",
];

// ─── State ────────────────────────────────────────────────────────────────────

type Phase = "confirm" | "egg" | "wobble" | "crack" | "reveal" | "card" | "decide" | "naming";

interface State {
  phase: Phase;
  wallet: WalletState;
  bones: BuddyBones | null;
  userId: string;
  pityTriggered: boolean;
  nameInput: string;
  animFrame: number;
  animStart: number;
  message: string;
  availablePacks: Pack[];
  selectedPack: number; // index into availablePacks, 0 = first pack
}

function freshState(): State {
  const packs = getAvailablePacks();
  return {
    phase: "confirm",
    wallet: loadWallet(),
    bones: null,
    userId: "",
    pityTriggered: false,
    nameInput: "",
    animFrame: 0,
    animStart: 0,
    message: "",
    availablePacks: packs,
    selectedPack: 0,
  };
}

// ─── Animation timing ────────────────────────────────────────────────────────

const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

function rarityIndex(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}

// Duration of wobble phase scales with rarity
function wobbleDurationMs(rarity: Rarity): number {
  return 1000 + rarityIndex(rarity) * 500; // 1s common → 3s legendary
}

function crackDurationMs(): number { return 800; }
function revealDurationMs(): number { return 600; }

// ─── Screen rendering ────────────────────────────────────────────────────────

const W = 42; // card width

function drawScreen(s: State): void {
  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;

  let out = "\x1b[2J\x1b[H"; // clear + home

  // Banner
  const bannerColor = s.bones ? RARITY_CLR[s.bones.rarity] : CY;
  out += center(`${bannerColor}${B}\u2605 BUDDY PULL \u2605${N}`, cols) + "\n";
  out += "\n";

  switch (s.phase) {
    case "confirm":
      out += drawConfirm(s, cols);
      break;
    case "egg":
    case "wobble":
      out += drawEgg(s, cols);
      break;
    case "crack":
      out += drawCrack(s, cols);
      break;
    case "reveal":
      out += drawReveal(s, cols);
      break;
    case "card":
    case "decide":
      out += drawCard(s, cols);
      break;
    case "naming":
      out += drawNaming(s, cols);
      break;
  }

  // Footer
  out += "\n";
  if (s.message) {
    out += center(`${YL}${s.message}${N}`, cols) + "\n";
  }

  process.stdout.write(out);
}

function drawConfirm(s: State, cols: number): string {
  const lines: string[] = [];
  const w = s.wallet;
  const affordable = w.coins >= PULL_COST;

  lines.push(center(`${B}Coins: ${affordable ? GN : RD}${w.coins}${N}`, cols));
  lines.push("");
  lines.push(center(`${D}Cost: ${PULL_COST} coins per pull${N}`, cols));
  lines.push(center(`${D}Pulls completed: ${w.pullCount}${N}`, cols));
  lines.push("");

  // Pack selection
  if (s.availablePacks.length > 1) {
    const packLabels = s.availablePacks.map((p, i) => {
      const selected = i === s.selectedPack;
      return selected ? `${B}${CY}[${p.icon} ${p.name}]${N}` : `${D} ${p.icon} ${p.name} ${N}`;
    }).join("  ");
    lines.push(center(`Pack: ${packLabels}`, cols));
    lines.push(center(`${D}\u2190\u2192 to switch pack${N}`, cols));
    lines.push("");
  } else if (s.availablePacks.length === 1) {
    const p = s.availablePacks[0];
    lines.push(center(`${D}Pack: ${p.icon} ${p.name}${N}`, cols));
    lines.push("");
  }

  if (w.pityEpic > 0 || w.pityLegendary > 0) {
    lines.push(center(`${D}Pity: epic ${w.pityEpic}/50  legendary ${w.pityLegendary}/100${N}`, cols));
    lines.push("");
  }

  // Egg preview
  for (const line of EGG_INTACT) {
    lines.push(center(`${D}${line}${N}`, cols));
  }
  lines.push("");

  if (affordable) {
    lines.push(center(`${GN}${B}[Enter]${N} Pull   ${D}[q] Quit${N}`, cols));
  } else {
    lines.push(center(`${RD}Not enough coins!${N}`, cols));
    lines.push(center(`${D}Earn coins by coding. [q] Quit${N}`, cols));
  }

  return lines.join("\n");
}

function drawEgg(s: State, cols: number): string {
  const elapsed = Date.now() - s.animStart;
  const lines: string[] = [];

  // Pick wobble frame
  const wobbleFrames = [EGG_INTACT, EGG_WOBBLE_LEFT, EGG_INTACT, EGG_WOBBLE_RIGHT];
  const cycleMs = 300;
  const frameIdx = Math.floor(elapsed / cycleMs) % wobbleFrames.length;
  const egg = wobbleFrames[frameIdx];

  const rarity = s.bones!.rarity;
  const clr = RARITY_CLR[rarity];

  // Rarity color hint: border pulses with increasing intensity
  const wobbleTotal = wobbleDurationMs(rarity);
  const progress = Math.min(1, elapsed / wobbleTotal);

  // Cycling rarity text as suspense builds
  const cycleIdx = Math.floor(elapsed / 200) % RARITY_ORDER.length;
  const displayRarity = progress < 0.8
    ? RARITY_ORDER[cycleIdx]
    : rarity; // settle on actual rarity in last 20%

  const dClr = RARITY_CLR[displayRarity];

  lines.push(center(`${dClr}${B}??? ${displayRarity.toUpperCase()} ???${N}`, cols));
  lines.push("");

  for (const line of egg) {
    lines.push(center(`${dClr}${line}${N}`, cols));
  }

  lines.push("");
  const dots = ".".repeat(Math.floor(elapsed / 300) % 4);
  lines.push(center(`${D}Hatching${dots}${N}`, cols));

  return lines.join("\n");
}

function drawCrack(s: State, cols: number): string {
  const elapsed = Date.now() - s.animStart;
  const lines: string[] = [];
  const rarity = s.bones!.rarity;
  const clr = RARITY_CLR[rarity];

  const crackFrames = [EGG_CRACK_1, EGG_CRACK_2, EGG_CRACK_3, EGG_OPEN];
  const frameDur = crackDurationMs() / crackFrames.length;
  const frameIdx = Math.min(crackFrames.length - 1, Math.floor(elapsed / frameDur));
  const egg = crackFrames[frameIdx];

  // Flash for legendary
  const flash = rarity === "legendary" && frameIdx === 2;
  if (flash) {
    lines.push("\x1b[7m"); // reverse video
  }

  lines.push(center(`${clr}${B}${rarity.toUpperCase()}!${N}`, cols));
  lines.push("");

  for (const line of egg) {
    lines.push(center(`${clr}${B}${line}${N}`, cols));
  }

  if (flash) {
    lines.push("\x1b[0m");
  }

  lines.push("");
  lines.push(center(`${clr}*CRACK!*${N}`, cols));

  return lines.join("\n");
}

function drawReveal(s: State, cols: number): string {
  const elapsed = Date.now() - s.animStart;
  const lines: string[] = [];
  const bones = s.bones!;
  const clr = RARITY_CLR[bones.rarity];

  // Get species art and reveal line by line
  const art = SPECIES_ART[bones.species]?.[0] ?? ["", "", "", "", ""];
  const totalLines = art.length;
  const revealedLines = Math.min(totalLines, Math.floor((elapsed / revealDurationMs()) * (totalLines + 1)));

  lines.push(center(`${clr}${B}${bones.rarity.toUpperCase()} ${bones.species.toUpperCase()}!${N}`, cols));
  if (bones.shiny) {
    lines.push(center(`${SHINY}\u2728 SHINY! \u2728${N}`, cols));
  }
  lines.push("");

  for (let i = 0; i < totalLines; i++) {
    if (i < revealedLines) {
      const rendered = art[i].replace(/\{E\}/g, bones.eye);
      lines.push(center(`${clr}${rendered}${N}`, cols));
    } else {
      lines.push("");
    }
  }

  return lines.join("\n");
}

function drawCard(s: State, cols: number): string {
  const bones = s.bones!;
  const name = s.nameInput || "???";
  const personality = `A ${bones.rarity} ${bones.species} who watches code with quiet intensity.`;
  const reaction = s.pityTriggered ? `*${name} hatches* (pity!)` : `*${name} hatches*`;

  const card = renderCompanionCard(bones, name, personality, reaction, 0, W);
  const cardLines = card.split("\n");

  const lines: string[] = [];
  for (const line of cardLines) {
    lines.push(center(line, cols));
  }

  lines.push("");

  if (s.phase === "decide") {
    lines.push(center(`${GN}${B}[k]${N} Keep   ${RD}${B}[d]${N} Discard   ${D}[q] Quit${N}`, cols));
  }

  return lines.join("\n");
}

function drawNaming(s: State, cols: number): string {
  const bones = s.bones!;
  const name = s.nameInput || "";
  const personality = `A ${bones.rarity} ${bones.species} who watches code with quiet intensity.`;

  const card = renderCompanionCard(bones, name || "???", personality, undefined, 0, W);
  const cardLines = card.split("\n");

  const lines: string[] = [];
  for (const line of cardLines) {
    lines.push(center(line, cols));
  }

  lines.push("");
  lines.push(center(`${B}Name your buddy:${N} ${s.nameInput}\u2588`, cols));
  lines.push(center(`${D}(1-14 chars, [enter] to confirm, [esc] to discard)${N}`, cols));

  return lines.join("\n");
}

// ─── Animation loop ──────────────────────────────────────────────────────────

let animTimer: ReturnType<typeof setTimeout> | null = null;

function startAnimation(s: State): void {
  stopAnimation();
  animTimer = setInterval(() => {
    const elapsed = Date.now() - s.animStart;

    if (s.phase === "egg" || s.phase === "wobble") {
      const dur = wobbleDurationMs(s.bones!.rarity);
      if (elapsed >= dur) {
        s.phase = "crack";
        s.animStart = Date.now();
      }
    } else if (s.phase === "crack") {
      if (elapsed >= crackDurationMs()) {
        s.phase = "reveal";
        s.animStart = Date.now();
      }
    } else if (s.phase === "reveal") {
      if (elapsed >= revealDurationMs()) {
        s.phase = "decide";
        stopAnimation();
      }
    }

    drawScreen(s);
  }, 50);
}

function stopAnimation(): void {
  if (animTimer) {
    clearInterval(animTimer);
    animTimer = null;
  }
}

// ─── Pull execution ──────────────────────────────────────────────────────────

function executePull(s: State): void {
  // Spend coins
  const w = loadWallet();
  w.coins -= PULL_COST;
  w.totalSpent += PULL_COST;
  saveWallet(w);

  // Generate buddy from selected pack
  const packId = s.availablePacks[s.selectedPack]?.id;
  const { bones, userId, pityTriggered } = pullBuddy(w, packId);

  // Update pity
  const w2 = loadWallet();
  updatePity(w2, bones.rarity);
  saveWallet(w2);

  // Track gacha events
  incrementEvent("pulls_total", 1);
  if (bones.rarity === "legendary") incrementEvent("legendary_pulls", 1);
  if (bones.shiny) incrementEvent("shiny_pulls", 1);

  s.bones = bones;
  s.userId = userId;
  s.pityTriggered = pityTriggered;
  s.nameInput = "";
  s.phase = "egg";
  s.animStart = Date.now();
  s.wallet = loadWallet();

  startAnimation(s);
}

// ─── Keep / discard ──────────────────────────────────────────────────────────

function keepBuddy(s: State): void {
  const bones = s.bones!;
  const buddyName = s.nameInput || unusedName();
  const slot = slugify(buddyName);

  if (loadCompanionSlot(slot)) {
    s.message = `Slot "${slot}" already exists! Pick a different name.`;
    s.phase = "naming";
    drawScreen(s);
    return;
  }

  const companion: Companion = {
    bones,
    name: buddyName,
    personality: `A ${bones.rarity} ${bones.species} who watches code with quiet intensity.`,
    hatchedAt: Date.now(),
    userId: s.userId,
  };

  saveCompanionSlot(companion, slot);
  saveActiveSlot(slot);
  saveReaction(`*${buddyName} hatches*`, "pull");
  writeStatusState(companion, `*${buddyName} hatches*`);

  const activeS = loadActiveSlot();
  checkAndAward(activeS);

  s.message = `${GN}\u2713 ${buddyName} saved to menagerie!${N}`;
  s.wallet = loadWallet();
  s.phase = "confirm";
  s.bones = null;
  drawScreen(s);
}

function discardBuddy(s: State): void {
  s.message = `${D}Discarded. The buddy vanishes into the mist.${N}`;
  s.wallet = loadWallet();
  s.phase = "confirm";
  s.bones = null;
  drawScreen(s);
}

// ─── Input handling ──────────────────────────────────────────────────────────

function handleKey(key: string, s: State): boolean {
  // Ctrl-C
  if (key === "\x03") return true;

  switch (s.phase) {
    case "confirm": {
      if (key === "q" || key === "\x1b") return true;
      // Left/right arrows to switch pack
      if (key === "\x1b[D" || key === "h") {
        s.selectedPack = (s.selectedPack - 1 + s.availablePacks.length) % s.availablePacks.length;
        drawScreen(s);
        return false;
      }
      if (key === "\x1b[C" || key === "l") {
        s.selectedPack = (s.selectedPack + 1) % s.availablePacks.length;
        drawScreen(s);
        return false;
      }
      if (key === "\r" || key === "\n") {
        if (canAfford(PULL_COST)) {
          s.message = "";
          executePull(s);
        } else {
          s.message = "Not enough coins!";
          drawScreen(s);
        }
      }
      return false;
    }

    case "egg":
    case "wobble":
    case "crack":
    case "reveal":
      // Animations are non-interruptible (building suspense!)
      return false;

    case "decide": {
      if (key === "k" || key === "\r" || key === "\n") {
        s.phase = "naming";
        s.nameInput = "";
        drawScreen(s);
      } else if (key === "d") {
        discardBuddy(s);
      } else if (key === "q") {
        discardBuddy(s);
        return true;
      }
      return false;
    }

    case "naming": {
      if (key === "\x1b") {
        // Esc — discard
        discardBuddy(s);
        return false;
      }
      if (key === "\r" || key === "\n") {
        // Enter — save
        keepBuddy(s);
        return false;
      }
      if (key === "\x7f" || key === "\b") {
        // Backspace
        s.nameInput = s.nameInput.slice(0, -1);
        s.message = "";
        drawScreen(s);
        return false;
      }
      // Printable character
      if (key.length === 1 && key >= " " && s.nameInput.length < 14) {
        s.nameInput += key;
        s.message = "";
        drawScreen(s);
      }
      return false;
    }
  }

  return false;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!isGachaMode()) {
    console.log("\n  Gacha mode is off. Enable it with:\n");
    console.log("    bun run settings gacha on");
    console.log("    /buddy gacha on\n");
    process.exit(0);
  }
  const s = freshState();

  // Setup terminal
  process.stdout.write("\x1b[?25l"); // hide cursor
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  drawScreen(s);

  // Cleanup handler
  const cleanup = () => {
    stopAnimation();
    process.stdout.write("\x1b[?25h"); // show cursor
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });

  // Input loop
  for await (const chunk of process.stdin) {
    const key = chunk.toString();
    const quit = handleKey(key, s);
    if (quit) {
      cleanup();
      process.exit(0);
    }
  }
}

main();
