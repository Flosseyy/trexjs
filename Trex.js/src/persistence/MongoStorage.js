/**
 * MongoStorage — Level 3+ persistence adapter
 * Drop-in replacement for JsonStorage.
 *
 * Usage:
 *   import { MongoStorage } from 'trex.js/persistence/MongoStorage';
 *   const trex = createTrex({ storage: new MongoStorage('mongodb://...') });
 *
 * Requires: npm install mongoose
 */

// Uncomment when mongoose is installed:
// import mongoose from 'mongoose';

const RuleSchema = {
  guildId: String,
  rules: Array,
  updatedAt: Date,
};

export class MongoStorage {
  constructor(uri) {
    this.uri = uri;
    this._connected = false;
    // this._model = mongoose.model('TrexRules', new mongoose.Schema(RuleSchema));
  }

  async _connect() {
    if (this._connected) return;
    // await mongoose.connect(this.uri);
    this._connected = true;
  }

  async loadRules(guildId) {
    await this._connect();
    // const doc = await this._model.findOne({ guildId });
    // return doc?.rules ?? [];
    throw new Error('MongoStorage: install mongoose and uncomment the implementation');
  }

  async saveRules(guildId, rules) {
    await this._connect();
    // await this._model.updateOne(
    //   { guildId },
    //   { $set: { rules, updatedAt: new Date() } },
    //   { upsert: true }
    // );
    throw new Error('MongoStorage: install mongoose and uncomment the implementation');
  }

  async loadConfig(guildId) {
    return {};
  }

  async saveConfig(_guildId, _config) {}
}
