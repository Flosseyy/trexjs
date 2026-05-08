/**
 * CooldownManager
 * Tracks per-user / per-channel / per-guild cooldowns for slash commands.
 */

export class CooldownManager {
  constructor() {
    this._store = new Map(); // key → expiry timestamp
  }

  /**
   * Build a compound key based on scope.
   * @param {'user'|'channel'|'guild'} scope
   * @param {string} commandName
   * @param {import('discord.js').CommandInteraction} interaction
   */
  getKey(scope, commandName, interaction) {
    const suffix = scope === 'user'    ? interaction.user.id
                 : scope === 'channel' ? interaction.channelId
                 :                       interaction.guildId;
    return `${commandName}:${scope}:${suffix}`;
  }

  /**
   * Check if a key is on cooldown.
   * @returns {number} ms remaining (0 if not on cooldown)
   */
  check(key) {
    const expiry = this._store.get(key);
    if (!expiry) return 0;
    const remaining = expiry - Date.now();
    if (remaining <= 0) {
      this._store.delete(key);
      return 0;
    }
    return remaining;
  }

  /**
   * Set a cooldown for a key.
   * @param {string} key
   * @param {number} duration ms
   */
  set(key, duration) {
    this._store.set(key, Date.now() + duration);
    // Auto-cleanup after expiry
    setTimeout(() => this._store.delete(key), duration);
  }
}
