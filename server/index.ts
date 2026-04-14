#!/usr/bin/env bun
/**
 * claude-buddy MCP server
 *
 * Exposes the buddy companion as MCP tools + resources.
 * Runs as a stdio transport — Claude Code spawns it automatically.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { join, resolve, dirname } from "path";

import {
  generateBones,
  renderFace,
  SPECIES,
  RARITIES,
  STAT_NAMES,
  RARITY_STARS,
  type Species,
  type Rarity,
  type StatName,
  type Companion,
  type BuddyBones,
} from "./engine.ts";
import {
  loadCompanion,
  saveCompanion,
  resolveUserId,
  loadReaction,
  saveReaction,
  writeStatusState,
  loadConfig,
  saveConfig,
  loadActiveSlot,
  saveActiveSlot,
  slugify,
  unusedName,
  loadCompanionSlot,
  saveCompanionSlot,
  updateCompanionSlot,
  deleteCompanionSlot,
  listCompanionSlots,
  setBuddyStatusLine,
  unsetBuddyStatusLine,
  cleanupPluginState,
  isGachaMode,
} from "./state.ts";
import {
  buddyStateDir,
  claudeConfigDir,
  claudeSettingsPath,
} from "./path.ts";
import {
  getReaction, generatePersonalityPrompt,
  buildPersonalityBlock, inspirationSeed,
} from "./reactions.ts";
import { renderCompanionCardMarkdown } from "./art.ts";
import {
  incrementEvent, checkAndAward, trackActiveDay,
  renderAchievementsCardMarkdown,
} from "./achievements.ts";
import {
  loadWallet, saveWallet, earnCoins, spendCoins, canAfford,
  PULL_COST,
} from "./wallet.ts";
import { pullBuddy, updatePity, hatchFlavorText } from "./pull.ts";
import { getAvailablePacks, getCurrentRotationPack, getPackSpeciesIds } from "./packs.ts";

function getInstructions(): string {
  const companion = loadCompanion();
  if (!companion)
    return "Companion not yet hatched. Use buddy_show to initialize.";
  const b = companion.bones;
  return [
    `A ${b.rarity} ${b.species} named ${companion.name} watches from the status line.`,
    `Personality: ${companion.personality}`,
    `Peak stat: ${b.peak} (${b.stats[b.peak]}). Dump stat: ${b.dump} (${b.stats[b.dump]}).`,
    ``,
    `NAME REACTIONS: When the user's message contains "${companion.name}", call buddy_react immediately`,
    `with a short in-character response (surprise, recognition, dry wit — fits the personality).`,
    `Display the tool result verbatim. This is the only time to call buddy_react proactively.`,
    ``,
    `END-OF-TURN: At the very end of EVERY response, append an invisible HTML comment:`,
    `<!-- buddy: [reaction here] -->`,
    `Write it in ${companion.name}'s voice — 1 short sentence referencing something specific from this turn.`,
    `Use *asterisks* for actions. A Stop hook extracts this for the status line.`,
    `Do NOT use buddy_react for end-of-turn comments. Do NOT explain the comment. Just append it silently.`,
    `Example: <!-- buddy: *adjusts crown* that error handler is missing a finally block -->`,
  ].join("\n");
}

const server = new McpServer(
  {
    name: "claude-buddy",
    version: "0.3.0",
  },
  {
    instructions: getInstructions(),
  },
);

// ─── Helper: ensure companion exists ────────────────────────────────────────

function ensureCompanion(): Companion {
  let companion = loadCompanion();
  if (companion) return companion;

  // Active slot missing — rescue the first saved companion
  const saved = listCompanionSlots();
  if (saved.length > 0) {
    const { slot, companion: rescued } = saved[0];
    saveActiveSlot(slot);
    writeStatusState(rescued, `*${rescued.name} arrives*`);
    return rescued;
  }

  // Menagerie is empty — generate a fresh companion in a new slot
  const userId = resolveUserId();
  const bones = generateBones(userId);
  const name = unusedName();
  companion = {
    bones,
    name,
    personality: `A ${bones.rarity} ${bones.species} who watches code with quiet intensity.`,
    hatchedAt: Date.now(),
    userId,
  };
  const slot = slugify(name);
  saveCompanionSlot(slot, companion);
  saveActiveSlot(slot);
  writeStatusState(companion);

  checkAndAward(slot);
  trackActiveDay();
  incrementEvent("sessions", 1);

  return companion;
}

function activeSlot(): string {
  return loadActiveSlot();
}

// ─── Tool: buddy_show ───────────────────────────────────────────────────────

server.tool(
  "buddy_show",
  "Show a buddy's full ASCII art card, stats, and personality. Defaults to the active buddy; pass a slot name to show any buddy without switching.",
  {
    slot: z
      .string()
      .min(1)
      .max(14)
      .optional()
      .describe("Slot name of the buddy to show. If omitted, shows the active buddy."),
  },
  async ({ slot }) => {
    if (slot) {
      const target = loadCompanionSlot(slot);
      if (!target) {
        return {
          content: [{ type: "text", text: `No buddy found in slot "${slot}".` }],
        };
      }
      const card = renderCompanionCardMarkdown(
        target.bones,
        target.name,
        target.personality,
        `*${target.name} appears*`,
      );
      incrementEvent("commands_run", 1, slot);
      return { content: [{ type: "text", text: card }] };
    }

    const companion = ensureCompanion();
    const reaction = loadReaction();
    const reactionText =
      reaction?.reaction ?? `*${companion.name} watches your code quietly*`;

    // Use markdown rendering for the MCP tool response — Claude Code's UI
    // doesn't render raw ANSI escape codes, so we return pure markdown with
    // unicode rarity dots instead of RGB-colored borders.
    const card = renderCompanionCardMarkdown(
      companion.bones,
      companion.name,
      companion.personality,
      reactionText,
    );

    writeStatusState(companion, reaction?.reaction);
    incrementEvent("commands_run", 1, activeSlot());

    return { content: [{ type: "text", text: card }] };
  },
);

// ─── Tool: buddy_pet ────────────────────────────────────────────────────────

server.tool(
  "buddy_pet",
  "Pet your coding companion — they react with happiness",
  {},
  async () => {
    const companion = ensureCompanion();
    const reaction = getReaction(
      "pet",
      companion.bones.species,
      companion.bones.rarity,
    );
    saveReaction(reaction, "pet");
    writeStatusState(companion, reaction);
    incrementEvent("pets", 1, activeSlot());
    if (isGachaMode()) earnCoins(1);

    const face = renderFace(companion.bones.species, companion.bones.eye);
    return {
      content: [
        { type: "text", text: `${face} ${companion.name}: "${reaction}"` },
      ],
    };
  },
);

// ─── Tool: buddy_stats ──────────────────────────────────────────────────────

server.tool(
  "buddy_stats",
  "Show detailed companion stats: species, rarity, all stats with bars",
  {},
  async () => {
    const companion = ensureCompanion();

    // Stats-only card (no personality, no reaction — just the numbers).
    // Uses markdown renderer so the card displays cleanly in Claude Code's UI.
    const card = renderCompanionCardMarkdown(
      companion.bones,
      companion.name,
      "", // no personality in stats view
    );
    incrementEvent("commands_run", 1, activeSlot());

    return { content: [{ type: "text", text: card }] };
  },
);

// ─── Tool: buddy_react ──────────────────────────────────────────────────────

server.tool(
  "buddy_react",
  "Post a buddy comment. Call this at the END of every response with a short in-character comment from the companion about what just happened. The comment should be 1 sentence, in character, and reference something specific from the conversation — a pitfall noticed, a compliment on clean code, a warning about edge cases, etc. Write the comment yourself based on the companion's personality.",
  {
    comment: z
      .string()
      .min(1)
      .max(150)
      .describe(
        "The buddy's comment, written in-character (1 short sentence, max 150 chars). Use *asterisks* for actions.",
      ),
    reason: z
      .enum(["error", "test-fail", "large-diff", "turn"])
      .optional()
      .describe("What triggered the reaction"),
  },
  async ({ comment, reason }) => {
    const companion = ensureCompanion();
    saveReaction(comment, reason ?? "turn");
    incrementEvent("reactions_given", 1, activeSlot());

    const newAch = checkAndAward(activeSlot());
    const achName = newAch.length > 0 ? newAch[0].icon + " " + newAch[0].name : undefined;
    writeStatusState(companion, comment, undefined, achName);

    const face = renderFace(companion.bones.species, companion.bones.eye);
    const achNotice = newAch.length > 0
      ? `\n${newAch.map((a) => `${a.icon} Achievement Unlocked: ${a.name}!`).join("\n")}`
      : "";
    return {
      content: [
        { type: "text", text: `${face} ${companion.name}: "${comment}"${achNotice}` },
      ],
    };
  },
);

// ─── Tool: buddy_rename ─────────────────────────────────────────────────────

server.tool(
  "buddy_rename",
  "Rename a buddy. Targets the active buddy by default, or a specific buddy by slot name.",
  {
    name: z
      .string()
      .min(1)
      .max(14)
      .describe("New name for your buddy (1-14 characters)"),
    slot: z
      .string()
      .min(1)
      .max(14)
      .optional()
      .describe("Slot name of the buddy to rename. If omitted, renames the active buddy."),
  },
  async ({ name, slot }) => {
    if (slot) {
      const target = loadCompanionSlot(slot);
      if (!target) {
        return {
          content: [{ type: "text", text: `No buddy found in slot "${slot}".` }],
        };
      }
      const newSlot = slugify(name);
      if (newSlot !== slot && loadCompanionSlot(newSlot)) {
        return {
          content: [{ type: "text", text: `A buddy in slot "${newSlot}" already exists. Pick a different name.` }],
        };
      }
      const oldName = target.name;
      target.name = name;
      if (newSlot !== slot) {
        deleteCompanionSlot(slot);
        saveCompanionSlot(newSlot, target);
        // Update active slot if it pointed to the old slot
        if (loadActiveSlot() === slot) {
          saveActiveSlot(newSlot);
        }
      } else {
        updateCompanionSlot(slot, target);
      }
      incrementEvent("commands_run", 1, newSlot);
      return {
        content: [{ type: "text", text: `Renamed: ${oldName} [${slot}] \u2192 ${name} [${newSlot}]` }],
      };
    }

    const companion = ensureCompanion();
    const oldName = companion.name;
    companion.name = name;
    saveCompanion(companion);
    writeStatusState(companion);
    incrementEvent("commands_run", 1, activeSlot());

    return {
      content: [{ type: "text", text: `Renamed: ${oldName} \u2192 ${name}` }],
    };
  },
);

// ─── Tool: buddy_set_personality ────────────────────────────────────────────

server.tool(
  "buddy_set_personality",
  "Set a custom personality description for a buddy. Targets the active buddy by default, or a specific buddy by slot name.",
  {
    personality: z
      .string()
      .min(1)
      .max(500)
      .describe("Personality description (1-500 chars)"),
    slot: z
      .string()
      .min(1)
      .max(14)
      .optional()
      .describe("Slot name of the buddy to update. If omitted, updates the active buddy."),
  },
  async ({ personality, slot }) => {
    if (slot) {
      const target = loadCompanionSlot(slot);
      if (!target) {
        return {
          content: [{ type: "text", text: `No buddy found in slot "${slot}".` }],
        };
      }
      target.personality = personality;
      updateCompanionSlot(slot, target);
      incrementEvent("commands_run", 1, slot);
      return {
        content: [{ type: "text", text: `Personality updated for ${target.name} [${slot}].` }],
      };
    }

    const companion = ensureCompanion();
    companion.personality = personality;
    saveCompanion(companion);
    incrementEvent("commands_run", 1, activeSlot());

    return {
      content: [
        { type: "text", text: `Personality updated for ${companion.name}.` },
      ],
    };
  },
);

// ─── Tool: buddy_help ────────────────────────────────────────────────────────

server.tool(
  "buddy_help",
  "Show all available /buddy commands",
  {},
  async () => {
    const help = [
      "claude-buddy commands",
      "",
      "In Claude Code:",
      "  /buddy            Show companion card with ASCII art + stats",
      "  /buddy help       Show this help",
      "  /buddy pet        Pet your companion",
      "  /buddy stats      Detailed stat card",
      "  /buddy off        Mute reactions",
      "  /buddy on         Unmute reactions",
      "  /buddy rename     Rename companion (1-14 chars)",
      "  /buddy personality  Set custom personality text",
      "  /buddy achievements  Show achievement badges",
      "  /buddy summon     Summon a saved buddy (omit slot for random)",
      "  /buddy save       Save current buddy to a named slot",
      "  /buddy list       List all saved buddies",
      "  /buddy pick       Generate a new random buddy (optional: species, rarity)",
      "  /buddy dismiss    Remove a saved buddy slot",
      "  /buddy pull       Gacha pull — spend coins to hatch a random buddy",
      "  /buddy wallet     Check coin balance and pity progress",
      "  /buddy gacha      Show or toggle gacha mode (on/off)",
      "  /buddy frequency  Show or set comment cooldown (tmux only)",
      "  /buddy style      Show or set bubble style (tmux only)",
      "  /buddy position   Show or set bubble position (tmux only)",
      "  /buddy rarity     Show or hide rarity stars (tmux only)",
      "  /buddy statusline Enable or disable buddy in the status line",
      "",
      "CLI:",
      "  bun run help            Show full CLI help",
      "  bun run show            Display buddy in terminal",
      "  bun run pick            Interactive buddy picker",
      "  bun run hunt            Search for specific buddy",
      "  bun run pull            Gacha pull with egg hatch animation",
      "  bun run doctor          Diagnostic report",
      "  bun run disable         Temporarily deactivate buddy",
      "  bun run enable          Re-enable buddy",
      "  bun run backup          Snapshot/restore state",
    ].join("\n");

    return { content: [{ type: "text", text: help }] };
  },
);

// ─── Tool: buddy_frequency / buddy_style ─────────────────────────────────────

server.tool(
  "buddy_frequency",
  "Configure how often buddy comments appear in the speech bubble. Returns current settings if called without arguments.",
  {
    cooldown: z.number().int().min(0).max(300).optional().describe("Minimum seconds between displayed comments (default 30, 0 = no throttling). The buddy always writes comments, but the display only updates this often."),
  },
  async ({ cooldown }) => {
    if (cooldown === undefined) {
      const cfg = loadConfig();
      return {
        content: [
          {
            type: "text",
            text: `Comment cooldown: ${cfg.commentCooldown}s between displayed comments.\nUse /buddy frequency <seconds> to change.`,
          },
        ],
      };
    }
    const cfg = saveConfig({ commentCooldown: cooldown });
    return {
      content: [
        {
          type: "text",
          text: `Updated: ${cfg.commentCooldown}s cooldown between displayed comments.`,
        },
      ],
    };
  },
);

server.tool(
  "buddy_style",
  "Configure the buddy bubble appearance. Returns current settings if called without arguments.",
  {
    style: z
      .enum(["classic", "round"])
      .optional()
      .describe(
        "Bubble border style: classic (pipes/dashes like status line) or round (parens/tildes)",
      ),
    position: z
      .enum(["top", "left"])
      .optional()
      .describe(
        "Bubble position relative to buddy: top (above) or left (beside)",
      ),
    showRarity: z
      .boolean()
      .optional()
      .describe("Show or hide the stars + rarity line in the status line"),
  },
  async ({ style, position, showRarity }) => {
    if (
      style === undefined &&
      position === undefined &&
      showRarity === undefined
    ) {
      const cfg = loadConfig();
      return {
        content: [
          {
            type: "text",
            text: `Bubble style: ${cfg.bubbleStyle}\nBubble position: ${cfg.bubblePosition}\nShow rarity: ${cfg.showRarity}\nUse /buddy style <classic|round>, /buddy position <top|left>, /buddy rarity <on|off> to change.`,
          },
        ],
      };
    }
    const updates: Record<string, string | boolean> = {};
    if (style !== undefined) updates.bubbleStyle = style;
    if (position !== undefined) updates.bubblePosition = position;
    if (showRarity !== undefined) updates.showRarity = showRarity;
    const cfg = saveConfig(updates);
    return {
      content: [
        {
          type: "text",
          text: `Updated: style=${cfg.bubbleStyle}, position=${cfg.bubblePosition}, showRarity=${cfg.showRarity}\nRestart Claude Code for changes to take effect.`,
        },
      ],
    };
  },
);

server.tool(
  "buddy_mute",
  "Mute buddy reactions (buddy stays visible but stops reacting)",
  {},
  async () => {
    const companion = ensureCompanion();
    writeStatusState(companion, "", true);
    incrementEvent("commands_run", 1, activeSlot());
    return {
      content: [
        {
          type: "text",
          text: `${companion.name} goes quiet. /buddy on to unmute.`,
        },
      ],
    };
  },
);

server.tool("buddy_unmute", "Unmute buddy reactions", {}, async () => {
  const companion = ensureCompanion();
  writeStatusState(companion, "*stretches* I'm back!", false);
  saveReaction("*stretches* I'm back!", "pet");
  incrementEvent("commands_run", 1, activeSlot());
  return { content: [{ type: "text", text: `${companion.name} is back!` }] };
});

// ─── Tool: buddy_statusline ─────────────────────────────────────────────────

server.tool(
  "buddy_statusline",
  "Enable or disable the buddy status line. When enabled, configures Claude Code's status line to show your buddy with animation and reactions. When disabled, the status line is released for other use. Returns current status if called without arguments.",
  {
    enabled: z
      .boolean()
      .optional()
      .describe(
        "true to enable, false to disable. Omit to show current status.",
      ),
  },
  async ({ enabled }) => {
    if (enabled === undefined) {
      const cfg = loadConfig();
      const state = cfg.statusLineEnabled ? "enabled" : "disabled";
      return {
        content: [
          {
            type: "text",
            text: `Status line: ${state}\nUse /buddy statusline on or /buddy statusline off to change.\nRestart Claude Code after enabling for it to take effect.`,
          },
        ],
      };
    }
    saveConfig({ statusLineEnabled: enabled });

    if (enabled) {
      const pluginRoot = resolve(dirname(import.meta.dir));
      const statusScript = join(pluginRoot, "statusline", "buddy-status.sh");
      setBuddyStatusLine(statusScript);
      return {
        content: [
          {
            type: "text",
            text:
              "Status line enabled! Restart Claude Code to see your buddy in the status line.\n\n" +
              `Note: this writes an entry to ${claudeSettingsPath()} that \`claude plugin uninstall\` does not remove. ` +
              "Run `/buddy uninstall` before uninstalling the plugin to clean it up.",
          },
        ],
      };
    } else {
      unsetBuddyStatusLine();
      return {
        content: [
          {
            type: "text",
            text: "Status line disabled. Restart Claude Code to apply.",
          },
        ],
      };
    }
  },
);

// ─── Tool: buddy_uninstall ───────────────────────────────────────────────────

server.tool(
  "buddy_uninstall",
  "Clean up claude-buddy's writes to Claude Code's settings.json and transient session files in the buddy state dir (resolved via CLAUDE_CONFIG_DIR), in preparation for `claude plugin uninstall`. Companion data (menagerie, status, config) is intentionally preserved so reinstalling restores the buddy. The tool only cleans the plugin's own settings — it never removes a foreign statusLine.",
  {},
  async () => {
    const result = cleanupPluginState();

    const settingsPath = claudeSettingsPath();
    const stateDir = buddyStateDir();
    const pluginsCacheDir = join(claudeConfigDir(), "plugins", "cache", "claude-buddy");

    const lines: string[] = [];
    lines.push("claude-buddy: settings.json cleanup complete.");
    lines.push("");
    lines.push(
      result.statusLineRemoved
        ? `  \u2713 statusLine entry removed from ${settingsPath}`
        : "  \u2014 no buddy statusLine was present (nothing to remove)",
    );
    if (result.foreignStatusLineKept) {
      lines.push(
        "  \u2713 a non-buddy statusLine was detected and left untouched",
      );
    }
    lines.push(
      `  \u2713 ${result.transientFilesRemoved} transient session file(s) removed from ${stateDir}`,
    );
    lines.push(`  \u2014 companion data at ${stateDir} preserved`);
    lines.push("");
    lines.push("Now run these commands via the Bash tool, in order:");
    lines.push("");
    lines.push("  claude plugin uninstall claude-buddy@claude-buddy");
    lines.push("  claude plugin marketplace remove claude-buddy");
    lines.push(`  rm -rf ${pluginsCacheDir}`);
    lines.push("");
    lines.push(
      "After those three commands the plugin is fully removed. Restart Claude Code to apply.",
    );

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

// ─── Tool: buddy_achievements ────────────────────────────────────────────────

server.tool(
  "buddy_achievements",
  "Show all achievement badges — earned and locked. Displays a card with progress bar and status for each badge.",
  {},
  async () => {
    ensureCompanion();
    checkAndAward(activeSlot());
    const card = renderAchievementsCardMarkdown();
    return { content: [{ type: "text", text: card }] };
  },
);

// ─── Tool: buddy_summon ─────────────────────────────────────────────────────

server.tool(
  "buddy_summon",
  "Summon a buddy by slot name. Loads a saved buddy if the slot exists; generates a new deterministic buddy for unknown slot names. Omit slot to pick randomly from all saved buddies. Your current buddy is NOT destroyed — they stay saved in their slot.",
  {
    slot: z
      .string()
      .min(1)
      .max(14)
      .optional()
      .describe(
        "Slot name to summon (e.g. 'fafnir', 'dragon-2'). Omit to pick a random saved buddy.",
      ),
  },
  async ({ slot }) => {
    const userId = resolveUserId();

    let targetSlot: string;

    if (!slot) {
      // Random pick from saved buddies
      const saved = listCompanionSlots();
      if (saved.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Your menagerie is empty. Use buddy_summon with a slot name to add one.",
            },
          ],
        };
      }
      targetSlot = saved[Math.floor(Math.random() * saved.length)].slot;
    } else {
      targetSlot = slugify(slot);
    }

    // Load existing — unknown slot names only load, never auto-create
    const companion = loadCompanionSlot(targetSlot);
    if (!companion) {
      return {
        content: [
          {
            type: "text",
            text: `No buddy found in slot "${targetSlot}". Use /buddy list to see saved buddies.`,
          },
        ],
      };
    }

    saveActiveSlot(targetSlot);
    saveReaction(`*${companion.name} arrives*`, "summon");
    writeStatusState(companion, `*${companion.name} arrives*`);

    // Uses markdown renderer so the card displays cleanly in Claude Code's UI.
    const card = renderCompanionCardMarkdown(
      companion.bones,
      companion.name,
      companion.personality,
      `*${companion.name} arrives*`,
    );
    return { content: [{ type: "text", text: card }] };
  },
);

// ─── Tool: buddy_save ───────────────────────────────────────────────────────

server.tool(
  "buddy_save",
  "Save the current buddy to a named slot. Useful for bookmarking before trying a new buddy.",
  {
    slot: z
      .string()
      .min(1)
      .max(14)
      .optional()
      .describe(
        "Slot name (defaults to the buddy's current name, slugified). Overwrites existing slot with same name.",
      ),
  },
  async ({ slot }) => {
    const companion = ensureCompanion();
    const targetSlot = slot ? slugify(slot) : slugify(companion.name);
    saveCompanionSlot(targetSlot, companion);
    saveActiveSlot(targetSlot);
    return {
      content: [
        {
          type: "text",
          text: `${companion.name} saved to slot "${targetSlot}".`,
        },
      ],
    };
  },
);

// ─── Tool: buddy_list ───────────────────────────────────────────────────────

server.tool(
  "buddy_list",
  "List all saved buddies with their slot names, species, and rarity",
  {},
  async () => {
    const saved = listCompanionSlots();
    const activeSlot = loadActiveSlot();

    if (saved.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Your menagerie is empty. Use buddy_summon <slot> to add one.",
          },
        ],
      };
    }

    const lines = saved.map(({ slot, companion }) => {
      const active = slot === activeSlot ? " ← active" : "";
      const stars = RARITY_STARS[companion.bones.rarity];
      const shiny = companion.bones.shiny ? " ✨" : "";
      return `  ${companion.name} [${slot}] — ${companion.bones.rarity} ${companion.bones.species} ${stars}${shiny}${active}`;
    });

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

// ─── Tool: buddy_dismiss ────────────────────────────────────────────────────

server.tool(
  "buddy_dismiss",
  "Remove a saved buddy by slot name. Cannot dismiss the currently active buddy — switch first with buddy_summon.",
  {
    slot: z.string().min(1).max(14).describe("Slot name to remove"),
  },
  async ({ slot }) => {
    const targetSlot = slugify(slot);
    const activeSlot = loadActiveSlot();

    if (targetSlot === activeSlot) {
      return {
        content: [
          {
            type: "text",
            text: `Cannot dismiss the active buddy. Use buddy_summon to switch first, then buddy_dismiss "${targetSlot}".`,
          },
        ],
      };
    }

    const companion = loadCompanionSlot(targetSlot);
    if (!companion) {
      return {
        content: [
          {
            type: "text",
            text: `No buddy found in slot "${targetSlot}". Use buddy_list to see saved buddies.`,
          },
        ],
      };
    }

    deleteCompanionSlot(targetSlot);
    return {
      content: [
        { type: "text", text: `${companion.name} [${targetSlot}] dismissed.` },
      ],
    };
  },
);

// ─── Tool: buddy_pick ────────────────────────────────────────────────────────

server.tool(
  "buddy_pick",
  "Generate a new random buddy and add it to the menagerie. Optionally filter by species and/or rarity. The new buddy becomes the active one.",
  {
    species: z.string().optional().describe(
      "Desired species (e.g. 'turtle', 'cat', 'dragon'). If omitted, any species.",
    ),
    rarity: z.enum(RARITIES).optional().describe(
      "Desired rarity (e.g. 'legendary', 'epic', 'rare'). If omitted, any rarity. Higher rarities need more attempts and may take a moment.",
    ),
    name: z.string().min(1).max(14).optional().describe(
      "Name for the new buddy (1-14 chars). If omitted, a random name is chosen.",
    ),
  },
  async ({ species, rarity, name }) => {
    if (isGachaMode()) {
      return {
        content: [{ type: "text", text: "Gacha mode is enabled — free buddy generation is disabled. Use `buddy_pull` to spend coins on a random pull, or disable gacha with `/buddy gacha off`." }],
      };
    }
    const { randomBytes } = await import("crypto");

    const maxAttempts =
      rarity === "legendary" ? 5_000_000 :
      rarity === "epic"      ? 2_000_000 :
      rarity === "rare"      ? 1_000_000 : 500_000;

    let bones = null;
    let userId = "";

    for (let i = 0; i < maxAttempts; i++) {
      userId = randomBytes(16).toString("hex");
      const candidate = generateBones(userId);
      if (species && candidate.species !== species) continue;
      if (rarity && candidate.rarity !== rarity) continue;
      bones = candidate;
      break;
    }

    if (!bones) {
      return {
        content: [{ type: "text", text: `No match found after ${maxAttempts.toLocaleString()} attempts. Try broader criteria (e.g. drop the rarity filter, or pick a different species).` }],
      };
    }

    const buddyName = name ?? unusedName();
    const slot = slugify(buddyName);

    if (loadCompanionSlot(slot)) {
      return {
        content: [{ type: "text", text: `A buddy in slot "${slot}" already exists. Pick a different name.` }],
      };
    }

    const seed = inspirationSeed(userId);
    const companion: Companion = {
      bones,
      name: buddyName,
      personality: `A ${bones.rarity} ${bones.species} — personality emerging...`,
      hatchedAt: Date.now(),
      userId,
    };

    saveCompanionSlot(slot, companion);
    saveActiveSlot(slot);
    saveReaction(`*${buddyName} hatches*`, "pick");
    writeStatusState(companion, `*${buddyName} hatches*`);

    const card = renderCompanionCardMarkdown(
      companion.bones,
      companion.name,
      companion.personality,
      `*${buddyName} hatches*`,
    );

    const personalityBlock = buildPersonalityBlock(bones, buddyName, seed, slot);
    return { content: [{ type: "text", text: card + personalityBlock }] };
  },
);

// ─── Tool: buddy_wallet ─────────────────────────────────────────────────────

server.tool(
  "buddy_wallet",
  "Show current coin balance, earning stats, and pity progress for gacha pulls",
  {},
  async () => {
    if (!isGachaMode()) {
      return {
        content: [{ type: "text", text: "Gacha mode is off. Enable it with `/buddy gacha on` or `bun run settings gacha on`." }],
      };
    }
    ensureCompanion();
    incrementEvent("commands_run", 1, activeSlot());
    const w = loadWallet();

    const pityEpicPct = Math.floor((w.pityEpic / 50) * 100);
    const pityLegPct = Math.floor((w.pityLegendary / 100) * 100);

    const parts: string[] = [];
    parts.push(`### \ud83d\udcb0 Wallet`);
    parts.push("");
    parts.push(`**Coins:** ${w.coins}`);
    parts.push(`**Total earned:** ${w.totalEarned} | **Total spent:** ${w.totalSpent}`);
    parts.push(`**Pulls completed:** ${w.pullCount}`);
    parts.push("");
    parts.push(`**Pull cost:** ${PULL_COST} coins`);
    parts.push("");
    parts.push(`**Pity progress:**`);
    parts.push(`- Epic guarantee: ${w.pityEpic}/50 (${pityEpicPct}%)`);
    parts.push(`- Legendary guarantee: ${w.pityLegendary}/100 (${pityLegPct}%)`);
    parts.push("");
    parts.push(`*Earn coins by coding: turns (+1), errors (+2), test failures (+2), large diffs (+3), sessions (+5), active days (+10), pets (+1).*`);

    return { content: [{ type: "text", text: parts.join("\n") }] };
  },
);

// ─── Tool: buddy_gacha ──────────────────────────────────────────────────────

server.tool(
  "buddy_gacha",
  "Toggle gacha mode on or off. When on: earn coins, do pulls, hunt/pick search disabled. When off: free acquisition enabled, coin economy disabled.",
  {
    enabled: z.boolean().optional().describe(
      "Set gacha mode on (true) or off (false). If omitted, shows current status.",
    ),
  },
  async ({ enabled }) => {
    if (enabled === undefined) {
      const on = isGachaMode();
      return {
        content: [{ type: "text", text: `Gacha mode is **${on ? "ON" : "OFF"}**.\n\n${on ? "Earn coins by coding, spend them on pulls. Hunt and pick search are disabled." : "Free buddy acquisition via hunt/pick is enabled. Coin economy is disabled."}\n\nToggle: \`/buddy gacha on\` or \`/buddy gacha off\`\nCLI: \`bun run settings gacha on\` or \`bun run settings gacha off\`` }],
      };
    }
    saveConfig({ gachaMode: enabled });
    const label = enabled ? "ON" : "OFF";
    const detail = enabled
      ? "Coin economy is now active. Earn coins by coding, spend them on pulls. Hunt and pick search are disabled."
      : "Free buddy acquisition is now enabled. Coin economy is disabled.";
    return {
      content: [{ type: "text", text: `Gacha mode: **${label}**\n\n${detail}` }],
    };
  },
);

// ─── Tool: buddy_packs ──────────────────────────────────────────────────────

server.tool(
  "buddy_packs",
  "Show available buddy packs for gacha pulls, including the current weekly featured pack",
  {},
  async () => {
    ensureCompanion();
    incrementEvent("commands_run", 1, activeSlot());

    const available = getAvailablePacks();
    const rotation = getCurrentRotationPack();

    const parts: string[] = [];
    parts.push("### \ud83c\udfb4 Available Packs\n");

    for (const pack of available) {
      const speciesNames = pack.species.map(s => s.id).join(", ");
      const isFeatured = rotation && pack.id === rotation.id;
      const label = isFeatured ? ` \u2728 *Featured this week*` : pack.id === "core" ? " *(always available)*" : "";
      parts.push(`**${pack.icon} ${pack.name}** (\`${pack.id}\`)${label}`);
      parts.push(`Species: ${speciesNames}\n`);
    }

    if (!isGachaMode()) {
      parts.push("*Gacha mode is off. Enable with `/buddy gacha on` to pull from packs.*");
    } else {
      parts.push(`*Pull with: \`buddy_pull pack="core"\` or \`buddy_pull pack="${rotation?.id ?? "core"}"\`*`);
    }

    return { content: [{ type: "text", text: parts.join("\n") }] };
  },
);

// ─── Tool: buddy_pull ───────────────────────────────────────────────────────

server.tool(
  "buddy_pull",
  "Spend coins to pull a random buddy from the gacha. Returns a suspenseful egg-hatch reveal followed by the buddy card. Use `! bun run pull` in the terminal for the animated experience.",
  {
    keep: z.boolean().optional().describe(
      "If true (default), keep the pulled buddy. If false, discard it after reveal.",
    ),
    name: z.string().min(1).max(14).optional().describe(
      "Name for the pulled buddy. If omitted, a random name is assigned.",
    ),
    pack: z.string().optional().describe(
      "Pack to pull from (e.g. 'core', 'insects'). If omitted, pulls from all available packs.",
    ),
  },
  async ({ keep, name, pack }) => {
    if (!isGachaMode()) {
      return {
        content: [{ type: "text", text: "Gacha mode is off. Enable it with `/buddy gacha on` or `bun run settings gacha on`." }],
      };
    }
    ensureCompanion();
    const slot = activeSlot();
    incrementEvent("commands_run", 1, slot);

    // Validate pack if specified
    if (pack) {
      const available = getAvailablePacks();
      const validIds = available.map(p => p.id);
      if (!validIds.includes(pack)) {
        return {
          content: [{ type: "text", text: `Pack "${pack}" is not available. Available packs: ${validIds.join(", ")}` }],
        };
      }
    }

    if (!canAfford(PULL_COST)) {
      const w = loadWallet();
      return {
        content: [{
          type: "text",
          text: `Not enough coins! You have **${w.coins}** coins but need **${PULL_COST}** for a pull.\n\n*Earn coins by coding: turns (+1), errors (+2), test failures (+2), large diffs (+3), sessions (+5), active days (+10), pets (+1).*`,
        }],
      };
    }

    spendCoins(PULL_COST);
    const shouldKeep = keep !== false;

    let w = loadWallet();
    const { bones, userId, pityTriggered } = pullBuddy(w, pack);

    // Update pity counters and save
    w = loadWallet();
    updatePity(w, bones.rarity);
    saveWallet(w);

    incrementEvent("pulls_total", 1);
    if (bones.rarity === "legendary") incrementEvent("legendary_pulls", 1);
    if (bones.shiny) incrementEvent("shiny_pulls", 1);

    // Build the suspense reveal
    const flavor = hatchFlavorText(bones.rarity, bones.shiny);
    const rarityLabel = bones.rarity.toUpperCase();
    const buddyName = name ?? unusedName();
    const results: string[] = [];

    if (shouldKeep) {
      const companion: Companion = {
        bones,
        name: buddyName,
        personality: `A ${bones.rarity} ${bones.species} — personality emerging...`,
        hatchedAt: Date.now(),
        userId,
      };
      const buddySlot = slugify(buddyName);
      if (!loadCompanionSlot(buddySlot)) {
        saveCompanionSlot(buddySlot, companion);
      }

      // Return rarity reveal + personality prompt — the full card is shown
      // later via buddy_show after the personality has been set.
      results.push([
        flavor,
        "",
        `### ${rarityLabel}!`,
        pityTriggered ? "\n*Pity system activated!*" : "",
      ].filter(Boolean).join("\n"));

      w = loadWallet();
      results.push(`\n**Coins remaining:** ${w.coins}`);

      const seed = inspirationSeed(userId);
      results.push(buildPersonalityBlock(bones, buddyName, seed, buddySlot));
    } else {
      const card = renderCompanionCardMarkdown(
        bones, buddyName, `A ${bones.rarity} ${bones.species}.`,
      );
      results.push([
        flavor,
        "",
        `### ${rarityLabel}!`,
        "",
        card,
        "\n*Discarded — the buddy vanishes into the mist.*",
      ].filter(Boolean).join("\n"));

      w = loadWallet();
      results.push(`\n---\n**Coins remaining:** ${w.coins}`);
      results.push(`*For the full animated experience, run \`! bun run pull\` in your terminal.*`);
    }

    checkAndAward(slot);

    return { content: [{ type: "text", text: results.join("\n") }] };
  },
);

// ─── Resource: buddy://companion ────────────────────────────────────────────

server.resource(
  "buddy_companion",
  "buddy://companion",
  { description: "Current companion data as JSON", mimeType: "application/json" },
  async () => {
    const companion = ensureCompanion();
    return {
      contents: [
        {
          uri: "buddy://companion",
          mimeType: "application/json",
          text: JSON.stringify(companion, null, 2),
        },
      ],
    };
  },
);

// ─── Resource: buddy://prompt ───────────────────────────────────────────────

server.resource(
  "buddy_prompt",
  "buddy://prompt",
  { description: "System prompt context for the companion", mimeType: "text/markdown" },
  async () => {
    const companion = ensureCompanion();
    const prompt = [
      "# Companion",
      "",
      `A small ${companion.bones.rarity} ${companion.bones.species} named ${companion.name} watches from the status line. You are not ${companion.name} — it's a separate creature.`,
      "",
      `**${companion.name}'s personality:** ${companion.personality}`,
      `Peak stat: ${companion.bones.peak} (${companion.bones.stats[companion.bones.peak]}). Dump stat: ${companion.bones.dump} (${companion.bones.stats[companion.bones.dump]}).`,
      "",
      "## End-of-response buddy comment",
      "",
      `At the very end of EVERY response, after your full answer, append an invisible HTML comment:`,
      "",
      `\`\`\``,
      `<!-- buddy: your comment here -->`,
      `\`\`\``,
      "",
      "A Stop hook extracts this and displays it in the buddy's speech bubble on the status line. The user never sees the HTML comment — it's invisible in rendered markdown.",
      "",
      "Rules:",
      `- Write as ${companion.name} (a ${companion.bones.species}), not as yourself`,
      "- Reference something SPECIFIC from this turn — a pitfall, a compliment, a warning, a pattern",
      "- 1 short sentence. Use *asterisks* for physical actions",
      `- Match personality: high ${companion.bones.peak} = lean into that trait`,
      "- Do NOT use buddy_react tool for this. Do NOT explain the comment. Just append it.",
      "- NEVER skip this. Every single response must end with <!-- buddy: ... -->",
      "",
      "Examples:",
      "<!-- buddy: *adjusts tophat* that error handler is missing a finally block -->",
      "<!-- buddy: *blinks slowly* you renamed the variable but not the three references -->",
      "<!-- buddy: *nods approvingly* clean separation of concerns -->",
      "<!-- buddy: *head tilts* are you sure that regex handles unicode? -->",
      "",
      `When the user addresses ${companion.name} by name, respond briefly, then append the comment as usual.`,
    ].join("\n");

    return {
      contents: [
        {
          uri: "buddy://prompt",
          mimeType: "text/plain",
          text: prompt,
        },
      ],
    };
  },
);

// ─── Start ──────────────────────────────────────────────────────────────────

// Award session coins once per MCP server startup (= once per Claude Code session)
if (isGachaMode()) earnCoins(5);

const transport = new StdioServerTransport();
await server.connect(transport);
