/**
 * Trex.js v2 — Public API
 *
 * import { createTrex } from 'trexjs';
 */

import 'dotenv/config';
import { TrexEngine } from './engine/TrexEngine.js';

export function createTrex(options = {}) {
  return new TrexEngine(options);
}

export { TrexEngine }               from './engine/TrexEngine.js';
export { JsonStorage }              from './persistence/JsonStorage.js';
export { createLogger }             from './logger/logger.js';
export { paginate }                 from './pagination/paginate.js';
export { VoicePlayer }              from './voice/VoicePlayer.js';
export { I18nProvider }             from './i18n/I18nProvider.js';
