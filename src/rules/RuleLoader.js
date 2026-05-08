/**
 * RuleLoader
 * Loads rules from the storage layer, with per-guild caching.
 * Rules are isolated per guild — no cross-contamination.
 */

import { JsonStorage } from '../persistence/JsonStorage.js';

export class RuleLoader {
  constructor(storage) {
    // Default to JSON storage (MVP). Can swap in MongoStorage, etc.
    this.storage = storage ?? new JsonStorage();
    this._cache = new Map(); // guildId → rules[]
  }

  async getRulesForGuild(guildId) {
    const key = guildId ?? 'global';

    if (this._cache.has(key)) {
      return this._cache.get(key);
    }

    const rules = await this.storage.loadRules(key);
    this._cache.set(key, rules);
    return rules;
  }

  /**
   * Force reload (e.g. after CLI edits a rule)
   */
  invalidate(guildId) {
    this._cache.delete(guildId ?? 'global');
  }

  async saveRule(guildId, rule) {
    const key = guildId ?? 'global';
    const rules = await this.getRulesForGuild(key);
    rules.push(rule);
    await this.storage.saveRules(key, rules);
    this.invalidate(key);
  }
}
