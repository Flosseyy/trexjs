/**
 * I18nProvider
 * Simple file-based internationalization.
 *
 * Structure:
 *   locales/
 *     en-US.js   → export default { "greet.hello": "Hello, {name}!" }
 *     es-ES.js   → export default { "greet.hello": "¡Hola, {name}!" }
 *
 * Usage:
 *   i18n.t('greet.hello', 'en-US', { name: 'Alice' })
 *   // → "Hello, Alice!"
 */

import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { createLogger } from '../logger/logger.js';

const log = createLogger('I18n');

export class I18nProvider {
  constructor(localesDir = './locales', defaultLocale = 'en-US') {
    this.localesDir = localesDir;
    this.defaultLocale = defaultLocale;
    this._strings = new Map(); // locale → { key: value }
  }

  async load() {
    if (!existsSync(this.localesDir)) {
      log.warn(`Locales directory "${this.localesDir}" not found — i18n disabled.`);
      return;
    }

    const files = await readdir(this.localesDir);
    for (const file of files) {
      if (!file.endsWith('.js') && !file.endsWith('.mjs')) continue;
      const locale = file.replace(/\.(m)?js$/, '');
      const url = pathToFileURL(path.resolve(this.localesDir, file)).href;
      try {
        const mod = await import(url);
        this._strings.set(locale, mod.default ?? mod);
        log.info(`Loaded locale: ${locale}`);
      } catch (err) {
        log.error(`Failed to load locale ${file}: ${err.message}`);
      }
    }
  }

  /**
   * Translate a key into a locale string, interpolating variables.
   * Falls back to defaultLocale, then to the key itself.
   */
  t(key, locale, vars = {}) {
    const strings = this._strings.get(locale)
                 ?? this._strings.get(this.defaultLocale)
                 ?? {};

    let value = strings[key] ?? key;

    // Interpolate {varName} placeholders
    for (const [k, v] of Object.entries(vars)) {
      value = value.replaceAll(`{${k}}`, String(v));
    }

    return value;
  }
}
