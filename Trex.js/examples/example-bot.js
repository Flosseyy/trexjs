/**
 * Example bot — Trex.js v2 (JavaScript)
 *
 * Shows the code-first API:
 *   - Commands are in src/commands/ (auto-discovered)
 *   - Events are in src/events/ (auto-discovered)
 *   - Preconditions are in src/preconditions/ (auto-discovered)
 *   - Plugins registered with bot.use()
 *   - Rule engine still available alongside slash commands
 *
 * Run: node src/bot.js
 */

import { createTrex, JsonStorage } from 'trexjs';
import { moderationPlugin } from 'trexjs/plugins/moderation';
import { voicePlugin } from 'trexjs/plugins/voice';

const bot = createTrex({
  storage: new JsonStorage('./data'),
  commandsDir:      './src/commands',
  eventsDir:        './src/events',
  preconditionsDir: './src/preconditions',
  hotReload:        process.env.NODE_ENV !== 'production',
  localesDir:       './locales',
  defaultLocale:    'en-US',
});

// Load plugins (they contribute slash commands + rule engine actions/conditions)
bot.use(moderationPlugin);
bot.use(voicePlugin);

// You can also register things inline without files:
bot.use({
  name: 'fun-inline',
  commands: [
    {
      data: (await import('discord.js')).SlashCommandBuilder
        ? null  // fill in normally — see src/commands/ for examples
        : null,
    },
  ],
  actions: {
    coinFlip: async (_config, event) => {
      const result = Math.random() > 0.5 ? 'Heads 🪙' : 'Tails 🪙';
      await event.reply(result);
    },
  },
  conditions: {
    isLucky: (event) => Math.random() > 0.5,
  },
});

// Rule engine still works exactly as before (no JSON required):
await bot.ruleLoader.saveRule('global', {
  name:  'spam-guard',
  when:  'message',
  if:    { isSpam: true },
  then:  [
    { action: 'deleteMessage' },
    { action: 'warnUser', reason: 'Spam detected' },
  ],
});

await bot.start();
