/**
 * Trex.js — public API entry point
 *
 * Usage:
 *   import { createTrex } from 'trex.js';
 *   const trex = createTrex();
 *   trex.use(moderationPlugin);
 *   await trex.start();
 */

import 'dotenv/config';
import { TrexEngine } from './engine/TrexEngine.js';

export function createTrex(options = {}) {
  return new TrexEngine(options);
}

export { TrexEngine } from './engine/TrexEngine.js';
export { JsonStorage } from './persistence/JsonStorage.js';
export { createLogger } from './logger/logger.js';
