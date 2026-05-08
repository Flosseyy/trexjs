/**
 * /ping command (TypeScript version)
 *
 * This file is auto-discovered by Trex.js from src/commands/
 * Full IntelliSense and type safety included.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { TrexCommand, CommandContext } from 'trexjs';

const command: TrexCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency'),

  cooldown: 5000,
  cooldownScope: 'user',
  preconditions: ['GuildOnly'],

  async run({ interaction, client }: CommandContext): Promise<void> {
    const start = Date.now();
    const msg   = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
    const latency = Date.now() - start;
    await interaction.editReply(
      `🏓 Pong! Latency: **${latency}ms** | API: **${Math.round(client.ws.ping)}ms**`
    );
  },
};

export default command;
