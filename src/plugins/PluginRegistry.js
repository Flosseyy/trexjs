/**
 * PluginRegistry
 * The central hub for plugin-contributed actions, conditions, and triggers.
 * Keeps plugins isolated from each other.
 */

export class PluginRegistry {
  constructor() {
    this._actions = new Map();
    this._conditions = new Map();
    this._triggers = new Map();
    this._plugins = [];
  }

  /**
   * Register a plugin object:
   * {
   *   name: 'moderation',
   *   actions: { banUser: fn, kickUser: fn },
   *   conditions: { isSpam: fn },
   *   triggers: { onVoiceJoin: fn }
   * }
   */
  register(plugin) {
    if (!plugin.name) throw new Error('Plugin must have a name');

    if (plugin.actions) {
      for (const [name, fn] of Object.entries(plugin.actions)) {
        this._actions.set(name, fn);
      }
    }

    if (plugin.conditions) {
      for (const [name, fn] of Object.entries(plugin.conditions)) {
        this._conditions.set(name, fn);
      }
    }

    if (plugin.triggers) {
      for (const [name, fn] of Object.entries(plugin.triggers)) {
        this._triggers.set(name, fn);
      }
    }

    this._plugins.push(plugin);

    // Allow plugins to run setup logic (e.g. schedule jobs, register slash commands)
    if (typeof plugin.setup === 'function') {
      plugin.setup();
    }
  }

  getAction(name) { return this._actions.get(name); }
  getCondition(name) { return this._conditions.get(name); }
  getTrigger(name) { return this._triggers.get(name); }

  list() {
    return this._plugins.map(p => ({
      name: p.name,
      actions: Object.keys(p.actions ?? {}),
      conditions: Object.keys(p.conditions ?? {}),
    }));
  }
}
