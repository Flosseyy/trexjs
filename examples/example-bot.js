/**
 * Example bot built with Trex.js
 *
 * Demonstrates:
 * - Plugin registration
 * - Programmatic rule creation (alternative to JSON files)
 * - Custom inline plugin
 *
 * Run: node examples/example-bot.js
 */

import { createTrex, JsonStorage } from '../src/index.js';
import { moderationPlugin } from '../plugins/moderation.js';

const trex = createTrex({
  storage: new JsonStorage('./data'),
});

// ── Load plugins ─────────────────────────────────────────────────────────────
trex.use(moderationPlugin);

// ── Load a custom inline plugin ───────────────────────────────────────────────
trex.use({
  name: 'fun',
  actions: {
    coinFlip: async (_config, event) => {
      const result = Math.random() > 0.5 ? 'Heads 🪙' : 'Tails 🪙';
      await event.reply(result);
    },
    rollDice: async (config, event) => {
      const sides = config.sides ?? 6;
      const result = Math.floor(Math.random() * sides) + 1;
      await event.reply(`🎲 You rolled a **${result}** (d${sides})`);
    },
  },
  conditions: {
    isDiceCommand: (event) => /^!roll\s*(\d+)?$/.test(event.content ?? ''),
  },
});

// ── Start the bot ─────────────────────────────────────────────────────────────
// Rules are loaded from ./data/global-rules.json (or per-guild files).
// You can also seed rules here programmatically:

await trex.ruleLoader.saveRule('global', {
  name: 'hello-world',
  when: 'message',
  if: { equals: '!hello' },
  then: [{ action: 'reply', text: 'Hey there! 👋 Built with Trex.js 🦖' }],
});

await trex.ruleLoader.saveRule('global', {
  name: 'coin-flip',
  when: 'message',
  if: { equals: '!flip' },
  then: [{ action: 'coinFlip' }],
});

await trex.ruleLoader.saveRule('global', {
  name: 'dice-roll',
  when: 'message',
  if: { isDiceCommand: true },
  then: [{ action: 'rollDice', sides: 20 }],
});

await trex.ruleLoader.saveRule('global', {
  name: 'spam-guard',
  when: 'message',
  if: { isSpam: true },
  then: [
    { action: 'deleteMessage' },
    { action: 'warnUser', reason: 'Spam detected' },
  ],
});

await trex.ruleLoader.saveRule('global', {
  name: 'welcome-member',
  when: 'memberJoin',
  if: {},
  then: [{ action: 'sendMessage', text: 'Welcome to the server! 🎉 Read the rules in #rules.' }],
});

await trex.start();
