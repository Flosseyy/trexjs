/**
 * VoicePlayer
 * Plays audio in a Discord voice channel using @discordjs/voice.
 *
 * Usage:
 *   import { VoicePlayer } from 'trexjs/voice';
 *
 *   const player = new VoicePlayer({ channel, client });
 *   player.play('https://example.com/audio.mp3');
 *   player.on('end', () => console.log('done'));
 */

import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';
import { EventEmitter } from 'events';
import { createLogger } from '../logger/logger.js';

const log = createLogger('VoicePlayer');

export class VoicePlayer extends EventEmitter {
  constructor({ channel, client }) {
    super();
    this.channel = channel;
    this.client = client;
    this._connection = null;
    this._player = null;
  }

  async _connect() {
    if (this._connection) return this._connection;

    this._connection = joinVoiceChannel({
      channelId: this.channel.id,
      guildId: this.channel.guild.id,
      adapterCreator: this.channel.guild.voiceAdapterCreator,
    });

    await entersState(this._connection, VoiceConnectionStatus.Ready, 30_000);

    this._player = createAudioPlayer();
    this._connection.subscribe(this._player);

    this._player.on(AudioPlayerStatus.Idle, () => {
      this.emit('end');
    });

    this._player.on('error', (err) => {
      log.error(`Audio error: ${err.message}`);
      this.emit('error', err);
    });

    return this._connection;
  }

  /**
   * Play an audio source.
   * @param {string | import('stream').Readable} source URL or readable stream
   */
  async play(source) {
    await this._connect();
    const resource = createAudioResource(source);
    this._player.play(resource);
    this.emit('start');
    log.info(`Playing audio in ${this.channel.name}`);
  }

  pause() {
    this._player?.pause();
  }

  resume() {
    this._player?.unpause();
  }

  stop() {
    this._player?.stop();
  }

  disconnect() {
    this._connection?.destroy();
    this._connection = null;
    this._player = null;
    log.info(`Disconnected from voice channel`);
  }
}
