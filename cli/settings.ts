#!/usr/bin/env bun
/**
 * cli/settings.ts — View and update buddy settings
 *
 * Usage:
 *   bun run settings                Show current settings
 *   bun run settings cooldown 0     Set comment cooldown (0-300 seconds)
 */

import { loadConfig, saveConfig } from "../server/state.ts";

const args = process.argv.slice(2);
const key = args[0];
const value = args[1];

if (!key) {
  const cfg = loadConfig();
  console.log(`
  code-buddy settings
  ─────────────────────
  Host type:         ${cfg.hostType}    (default host for buddy integrations and soul generation)
  Comment cooldown:  ${cfg.commentCooldown}s    (0 = no throttling, default 30)
  Reaction TTL:      ${cfg.reactionTTL}s    (0 = permanent, default 0)
  Gacha mode:        ${cfg.gachaMode ? "on" : "off"}    (on = coin economy + pulls, off = free hunt/pick)

  Change:  bun run settings cooldown <seconds>
           bun run settings ttl <seconds>
           bun run settings host claude|codex
           bun run settings gacha on|off
`);
  process.exit(0);
}

if (key === "host") {
  if (value === undefined) {
    const cfg = loadConfig();
    console.log(`Host type: ${cfg.hostType}`);
    process.exit(0);
  }

  if (value !== "claude" && value !== "codex") {
    console.error("Error: host must be 'claude' or 'codex'");
    process.exit(1);
  }

  const cfg = saveConfig({ hostType: value });
  console.log(`Updated: host type → ${cfg.hostType}`);
  console.log(`  Default soul generation now follows the ${cfg.hostType} host unless you override it with --llm.`);
  process.exit(0);
}

if (key === "cooldown") {
  if (value === undefined) {
    const cfg = loadConfig();
    console.log(`Comment cooldown: ${cfg.commentCooldown}s`);
    process.exit(0);
  }

  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0 || n > 300) {
    console.error("Error: cooldown must be 0-300 (seconds)");
    process.exit(1);
  }

  const cfg = saveConfig({ commentCooldown: n });
  console.log(`Updated: comment cooldown → ${cfg.commentCooldown}s`);
  process.exit(0);
}

if (key === "ttl") {
  if (value === undefined) {
    const cfg = loadConfig();
    console.log(`Reaction TTL: ${cfg.reactionTTL}s`);
    process.exit(0);
  }

  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0 || n > 300) {
    console.error("Error: ttl must be 0-300 (seconds, 0 = permanent)");
    process.exit(1);
  }

  const cfg = saveConfig({ reactionTTL: n });
  console.log(`Updated: reaction TTL → ${cfg.reactionTTL}s${n === 0 ? " (permanent)" : ""}`);
  process.exit(0);
}

if (key === "gacha") {
  if (value === undefined) {
    const cfg = loadConfig();
    console.log(`Gacha mode: ${cfg.gachaMode ? "on" : "off"}`);
    process.exit(0);
  }

  if (value !== "on" && value !== "off") {
    console.error("Error: gacha must be 'on' or 'off'");
    process.exit(1);
  }

  const enabled = value === "on";
  const cfg = saveConfig({ gachaMode: enabled });
  console.log(`Updated: gacha mode → ${cfg.gachaMode ? "on" : "off"}`);
  if (enabled) {
    console.log("  Coin economy active. Earn coins by coding, spend them on pulls.");
    console.log("  Hunt and pick search are now disabled.");
  } else {
    console.log("  Free buddy acquisition enabled. Coin economy disabled.");
  }
  process.exit(0);
}

console.error(`Unknown setting: ${key}`);
console.error("Available: host, cooldown, ttl, gacha");
process.exit(1);
