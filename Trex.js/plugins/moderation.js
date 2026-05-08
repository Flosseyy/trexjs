/**
 * Moderation Plugin v2
 *
 * Provides:
 *   Slash commands: /warn, /kick, /ban, /purge, /timeout
 *   Actions (rule engine): warnUser, kickUser, banUser, purgeMessages
 *   Conditions (rule engine): isSpam, hasWarnings
 *
 * Usage:
 *   import { moderationPlugin } from 'trexjs/plugins/moderation';
 *   bot.use(moderationPlugin);
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createLogger } from '../src/logger/logger.js';

const log = createLogger('ModerationPlugin');
const warnings = new Map(); // userId → count

// ─── Slash Commands ───────────────────────────────────────────────────────────

const warnCommand = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(o => o.setName('user').setDescription('The user to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the warning')),

  requiredPermissions: [PermissionFlagsBits.ModerateMembers],
  preconditions: ['GuildOnly'],

  async run({ interaction }) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const count = (warnings.get(target.id) ?? 0) + 1;
    warnings.set(target.id, count);

    await target.send(`⚠️ You have been warned in **${interaction.guild.name}**: ${reason} (${count}/3)`).catch(() => {});

    if (count >= 3) {
      await target.timeout(600_000, 'Exceeded warning limit');
      await interaction.reply(`🔇 **${target.user.tag}** has been timed out after ${count} warnings.`);
    } else {
      await interaction.reply(`⚠️ Warned **${target.user.tag}** (${count}/3): ${reason}`);
    }
    log.info(`Warned ${target.id} (${count}/3)`);
  },
};

const kickCommand = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(o => o.setName('user').setDescription('The user to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),

  requiredPermissions: [PermissionFlagsBits.KickMembers],
  preconditions: ['GuildOnly'],

  async run({ interaction }) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    if (!target.kickable) {
      await interaction.reply({ content: '❌ I cannot kick this user.', ephemeral: true });
      return;
    }
    await target.kick(reason);
    await interaction.reply(`👢 Kicked **${target.user.tag}**: ${reason}`);
  },
};

const banCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(o => o.setName('user').setDescription('The user to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason'))
    .addIntegerOption(o => o.setName('days').setDescription('Messages to delete (days)').setMinValue(0).setMaxValue(7)),

  requiredPermissions: [PermissionFlagsBits.BanMembers],
  preconditions: ['GuildOnly'],

  async run({ interaction }) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const days   = interaction.options.getInteger('days') ?? 0;
    if (!target.bannable) {
      await interaction.reply({ content: '❌ I cannot ban this user.', ephemeral: true });
      return;
    }
    await target.ban({ reason, deleteMessageDays: days });
    await interaction.reply(`🔨 Banned **${target.user.tag}**: ${reason}`);
  },
};

const purgeCommand = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages')
    .addIntegerOption(o => o.setName('count').setDescription('Number of messages').setRequired(true).setMinValue(1).setMaxValue(100)),

  requiredPermissions: [PermissionFlagsBits.ManageMessages],
  preconditions: ['GuildOnly'],
  defer: true,
  ephemeral: true,

  async run({ interaction }) {
    const count   = interaction.options.getInteger('count');
    const deleted = await interaction.channel.bulkDelete(count, true);
    await interaction.editReply(`🗑️ Deleted ${deleted.size} messages.`);
  },
};

const timeoutCommand = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user')
    .addUserOption(o => o.setName('user').setDescription('User to timeout').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(10080))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),

  requiredPermissions: [PermissionFlagsBits.ModerateMembers],
  preconditions: ['GuildOnly'],

  async run({ interaction }) {
    const target  = interaction.options.getMember('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason  = interaction.options.getString('reason') ?? 'No reason provided';
    await target.timeout(minutes * 60_000, reason);
    await interaction.reply(`🔇 **${target.user.tag}** timed out for ${minutes} minute(s): ${reason}`);
  },
};

// ─── Rule Engine Actions ──────────────────────────────────────────────────────

const actions = {
  warnUser: async (config, event) => {
    const userId = event.authorId;
    const count  = (warnings.get(userId) ?? 0) + 1;
    warnings.set(userId, count);
    const reason = config.reason ?? 'No reason provided';
    await event.reply(`⚠️ Warning ${count}/3: ${reason}`);
    log.info(`Warned ${userId} (${count}/3): ${reason}`);
    if (count >= 3) {
      const member = event.raw.member;
      await member?.timeout(600_000, 'Exceeded warning limit');
    }
  },

  kickUser: async (config, event) => {
    const member = event.raw.member;
    if (!member?.kickable) { await event.reply('❌ I cannot kick this user.'); return; }
    await member.kick(config.reason ?? 'Rule triggered kick');
    log.info(`Kicked ${member.id}`);
  },

  banUser: async (config, event) => {
    const member = event.raw.member;
    if (!member?.bannable) { await event.reply('❌ I cannot ban this user.'); return; }
    await member.ban({ reason: config.reason ?? 'Rule triggered ban' });
    log.info(`Banned ${member.id}`);
  },

  purgeMessages: async (config, event) => {
    const count   = config.count ?? 10;
    const channel = event.raw.channel;
    const deleted = await channel.bulkDelete(count, true);
    log.info(`Purged ${deleted.size} messages`);
  },
};

// ─── Rule Engine Conditions ───────────────────────────────────────────────────

const conditions = {
  isSpam: (event) => {
    const content     = event.content ?? '';
    const capsRatio   = (content.match(/[A-Z]/g) ?? []).length / (content.length || 1);
    const hasRepeat   = /(.)\\1{4,}/.test(content);
    const spamPhrases = ['free nitro', 'click here', 'discord.gift'];
    const hasSpam     = spamPhrases.some(p => content.toLowerCase().includes(p));
    return capsRatio > 0.7 || hasRepeat || hasSpam;
  },

  hasWarnings: (event, minCount) => {
    return (warnings.get(event.authorId) ?? 0) >= minCount;
  },
};

// ─── Plugin Export ────────────────────────────────────────────────────────────

export const moderationPlugin = {
  name: 'moderation',

  commands: [warnCommand, kickCommand, banCommand, purgeCommand, timeoutCommand],

  actions,
  conditions,
};
