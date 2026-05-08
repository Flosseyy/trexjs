/**
 * PluginRegistry v2
 * Stores plugin-contributed actions and conditions for the rule engine.
 * Commands, events, and preconditions are handled by the engine directly.
 */

export class PluginRegistry {
  constructor() {
    this._actions    = new Map();
    this._conditions = new Map();
    this._plugins    = [];
  }

  register(plugin, engine) {
    if (!plugin.name) throw new Error('Plugin must have a name');

    for (const [name, fn] of Object.entries(plugin.actions ?? {})) {
      this._actions.set(name, fn);
    }

    for (const [name, fn] of Object.entries(plugin.conditions ?? {})) {
      this._conditions.set(name, fn);
    }

    this._plugins.push(plugin);

    if (typeof plugin.setup === 'function') {
      plugin.setup(engine);
    }
  }

  getAction(name)    { return this._actions.get(name); }
  getCondition(name) { return this._conditions.get(name); }

  list() {
    return this._plugins.map(p => ({
      name: p.name,
      actions:    Object.keys(p.actions    ?? {}),
      conditions: Object.keys(p.conditions ?? {}),
    }));
  }
}
