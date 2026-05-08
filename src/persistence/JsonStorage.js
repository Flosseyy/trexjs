/**
 * JsonStorage
 * MVP persistence adapter. Stores rules and guild configs as local JSON files.
 * Swap for MongoStorage or PostgresStorage by passing a different adapter to TrexEngine.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export class JsonStorage {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
  }

  async _ensureDir() {
    if (!existsSync(this.dataDir)) {
      await mkdir(this.dataDir, { recursive: true });
    }
  }

  _rulesPath(guildId) {
    return path.join(this.dataDir, `${guildId}-rules.json`);
  }

  _configPath(guildId) {
    return path.join(this.dataDir, `${guildId}-config.json`);
  }

  async loadRules(guildId) {
    await this._ensureDir();
    const filePath = this._rulesPath(guildId);
    if (!existsSync(filePath)) return [];
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  }

  async saveRules(guildId, rules) {
    await this._ensureDir();
    await writeFile(this._rulesPath(guildId), JSON.stringify(rules, null, 2), 'utf-8');
  }

  async loadConfig(guildId) {
    await this._ensureDir();
    const filePath = this._configPath(guildId);
    if (!existsSync(filePath)) return {};
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  }

  async saveConfig(guildId, config) {
    await this._ensureDir();
    await writeFile(this._configPath(guildId), JSON.stringify(config, null, 2), 'utf-8');
  }
}
