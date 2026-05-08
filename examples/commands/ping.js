/**
 * /ping command
 *
 * Demonstrates:
 *   - SlashCommandBuilder for command definition
 *   - JSDoc type annotation for IntelliSense (no TS required)
 *   - Preconditions, cooldowns, permissions
 *
 * This file is auto-discovered by Trex.js from src/commands/
 */

import { SlashCommandBuilder } from 'discord.js';

/** @type {import('trexjs').TrexCommand} */
const command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency'),

  cooldown: 5000,         // 5s cooldown
  cooldownScope: 'user',
  preconditions: ['GuildOnly'],

  async run({ interaction, client }) {
    const start = Date.now();
    const msg   = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
    const latency = Date.now() - start;
    await interaction.editReply(`🏓 Pong! Latency: **${latency}ms** | API: **${Math.round(client.ws.ping)}ms**`);
  },
};

export default command;
