/**
 * FileWatcher
 * Uses chokidar to watch directories for changes.
 * Triggers a callback on add/change events.
 */

import { createLogger } from '../logger/logger.js';

const log = createLogger('FileWatcher');

export class FileWatcher {
  constructor(dirs, onChange) {
    this.dirs = dirs;
    this.onChange = onChange;
    this._watcher = null;
  }

  async start() {
    const chokidar = await import('chokidar');
    this._watcher = chokidar.default.watch(this.dirs, {
      ignoreInitial: true,
      ignored: /(^|[/\\])\../,
    });

    this._watcher.on('change', (filePath) => {
      log.info(`File changed: ${filePath}`);
      this.onChange(filePath);
    });

    this._watcher.on('add', (filePath) => {
      log.info(`File added: ${filePath}`);
      this.onChange(filePath);
    });
  }

  stop() {
    this._watcher?.close();
  }
}
