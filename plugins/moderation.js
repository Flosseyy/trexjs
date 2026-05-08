/**
 * Moderation Plugin — sample plugin for Trex.js
 *
 * Demonstrates how to package new actions + conditions as a plugin.
 *
 * Usage:
 *   import { moderationPlugin } from 'trex.js/plugins/moderation';
 *   trex.use(moderationPlugin);
 *
 * Then in rules.json you can use:
 *   { "action": "warnUser", "reason": "Spam" }
 *   { "action": "kickUser", "reason": "Rule violation" }
 *   { "if": { "isSpam": true } }
 */

import { createLogger } from '../src/logger/logger.js';

const log = createLogger('ModerationPlugin');

// Simple in-memory warning store (swap for DB in production)
const warnings = new Map(); // userId → count

export const moderationPlugin = {
  name: 'moderation',

  actions: {
    warnUser: async (config, event) => {
      const userId = event.authorId;
      const count = (warnings.get(userId) ?? 0) + 1;
      warnings.set(userId, count);
      const reason = config.reason ?? 'No reason provided';
      await event.reply(`⚠️ Warning ${count}/3: ${reason}`);
      log.info(`Warned user ${userId} (${count}/3): ${reason}`);

      if (count >= 3) {
        const member = event.raw.member;
        await member?.timeout(600_000, 'Exceeded warning limit');
        log.info(`Auto-timed out ${userId} after 3 warnings`);
      }
    },

    kickUser: async (config, event) => {
      const member = event.raw.member;
      if (!member?.kickable) {
        await event.reply('I cannot kick this user.');
        return;
      }
      await member.kick(config.reason ?? 'Rule triggered kick');
      log.info(`Kicked user ${member.id}`);
    },

    banUser: async (config, event) => {
      const member = event.raw.member;
      if (!member?.bannable) {
        await event.reply('I cannot ban this user.');
        return;
      }
      await member.ban({ reason: config.reason ?? 'Rule triggered ban' });
      log.info(`Banned user ${member.id}`);
    },

    purgeMessages: async (config, event) => {
      const count = config.count ?? 10;
      const channel = event.raw.channel;
      const deleted = await channel.bulkDelete(count, true);
      log.info(`Purged ${deleted.size} messages in channel ${channel.id}`);
    },
  },

  conditions: {
    // Detects simple spam patterns (caps, repeated chars, known spam phrases)
    isSpam: (event, _value) => {
      const content = event.content ?? '';
      const capsRatio = (content.match(/[A-Z]/g) ?? []).length / content.length;
      const hasRepeat = /(.)\1{4,}/.test(content);
      const spamPhrases = ['free nitro', 'click here', 'discord.gift'];
      const hasSpamPhrase = spamPhrases.some(p => content.toLowerCase().includes(p));
      return capsRatio > 0.7 || hasRepeat || hasSpamPhrase;
    },

    // Check if user has N or more warnings
    hasWarnings: (event, minCount) => {
      return (warnings.get(event.authorId) ?? 0) >= minCount;
    },
  },
};
