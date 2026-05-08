/**
 * Voice Plugin
 *
 * Provides slash commands for voice channel audio playback.
 *
 * Usage:
 *   import { voicePlugin } from 'trexjs/plugins/voice';
 *   bot.use(voicePlugin);
 *
 * Slash commands:
 *   /play <url>   — play audio from a URL
 *   /pause        — pause playback
 *   /resume       — resume playback
 *   /stop         — stop and disconnect
 */

import { SlashCommandBuilder } from 'discord.js';
import { VoicePlayer } from '../src/voice/VoicePlayer.js';

const players = new Map(); // guildId → VoicePlayer

export const voicePlugin = {
  name: 'voice',

  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play audio in your voice channel')
        .addStringOption(o => o.setName('url').setDescription('Audio URL to play').setRequired(true)),

      preconditions: ['GuildOnly'],

      async run({ interaction, client }) {
        const member  = interaction.member;
        const channel = member?.voice?.channel;

        if (!channel) {
          await interaction.reply({ content: '❌ Join a voice channel first.', ephemeral: true });
          return;
        }

        const url = interaction.options.getString('url');

        let player = players.get(interaction.guildId);
        if (!player) {
          player = new VoicePlayer({ channel, client });
          players.set(interaction.guildId, player);
          player.on('end', () => {
            players.delete(interaction.guildId);
          });
        }

        await player.play(url);
        await interaction.reply(`▶️ Playing in **${channel.name}**`);
      },
    },

    {
      data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause audio playback'),

      preconditions: ['GuildOnly'],

      async run({ interaction }) {
        players.get(interaction.guildId)?.pause();
        await interaction.reply('⏸️ Paused.');
      },
    },

    {
      data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume audio playback'),

      preconditions: ['GuildOnly'],

      async run({ interaction }) {
        players.get(interaction.guildId)?.resume();
        await interaction.reply('▶️ Resumed.');
      },
    },

    {
      data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback and disconnect'),

      preconditions: ['GuildOnly'],

      async run({ interaction }) {
        players.get(interaction.guildId)?.disconnect();
        players.delete(interaction.guildId);
        await interaction.reply('⏹️ Stopped and disconnected.');
      },
    },
  ],
};
