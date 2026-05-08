/**
 * /help command — demonstrates the pagination helper
 *
 * Splits commands across multiple embeds with ◀ ▶ navigation.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

/** @type {import('trexjs').TrexCommand} */
const command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Browse all available commands'),

  defer: true,

  async run({ interaction, client }) {
    const { paginate } = await import('trexjs');

    // Build one embed per category
    const pages = [
      new EmbedBuilder()
        .setTitle('📋 General Commands')
        .setColor(0x5865F2)
        .addFields(
          { name: '/ping',  value: 'Check bot latency' },
          { name: '/help',  value: 'Show this menu' },
        ),
      new EmbedBuilder()
        .setTitle('🛡️ Moderation Commands')
        .setColor(0xED4245)
        .addFields(
          { name: '/warn <user> [reason]',       value: 'Warn a user (3 strikes → timeout)' },
          { name: '/kick <user> [reason]',       value: 'Kick a user from the server' },
          { name: '/ban <user> [reason] [days]', value: 'Permanently ban a user' },
          { name: '/timeout <user> <minutes>',   value: 'Temporarily mute a user' },
          { name: '/purge <count>',              value: 'Bulk delete messages (max 100)' },
        ),
      new EmbedBuilder()
        .setTitle('🎵 Voice Commands')
        .setColor(0x57F287)
        .addFields(
          { name: '/play <url>',  value: 'Play audio from a URL' },
          { name: '/pause',       value: 'Pause playback' },
          { name: '/resume',      value: 'Resume playback' },
          { name: '/stop',        value: 'Stop and disconnect' },
        ),
    ];

    // Set page numbers in footer
    pages.forEach((p, i) => p.setFooter({ text: `Page ${i + 1} of ${pages.length}` }));

    await paginate({ interaction, pages, timeout: 90_000 });
  },
};

export default command;
