/**
 * ConditionEvaluator
 * Evaluates IF conditions from a rule against a normalized Trex event.
 * Built-in conditions are registered here; plugins can extend them.
 */

export class ConditionEvaluator {
  constructor(pluginRegistry) {
    this.plugins = pluginRegistry;

    // Built-in condition handlers
    this._conditions = {
      equals: (event, value) =>
        event.content?.toLowerCase() === value.toLowerCase(),

      contains: (event, value) =>
        event.content?.toLowerCase().includes(value.toLowerCase()),

      startsWith: (event, value) =>
        event.content?.toLowerCase().startsWith(value.toLowerCase()),

      endsWith: (event, value) =>
        event.content?.toLowerCase().endsWith(value.toLowerCase()),

      hasRole: (event, roleName) =>
        event.roles?.some(r => r.toLowerCase() === roleName.toLowerCase()),

      inChannel: (event, channelId) =>
        event.channelId === channelId,

      fromUser: (event, userId) =>
        event.authorId === userId,

      // Allows combining multiple conditions with AND logic
      all: async (event, conditions) => {
        for (const [key, value] of Object.entries(conditions)) {
          if (!(await this._evaluate(key, event, value))) return false;
        }
        return true;
      },

      // Allows combining multiple conditions with OR logic
      any: async (event, conditions) => {
        for (const [key, value] of Object.entries(conditions)) {
          if (await this._evaluate(key, event, value)) return true;
        }
        return false;
      },
    };
  }

  /**
   * Evaluate the full IF block of a rule.
   * rule.if can be a single condition object or null (always match).
   */
  async evaluate(ifBlock, event) {
    if (!ifBlock || Object.keys(ifBlock).length === 0) return true;

    for (const [conditionName, value] of Object.entries(ifBlock)) {
      const result = await this._evaluate(conditionName, event, value);
      if (!result) return false;
    }
    return true;
  }

  async _evaluate(conditionName, event, value) {
    // Check plugin-registered conditions first
    const pluginCondition = this.plugins.getCondition(conditionName);
    if (pluginCondition) {
      return await pluginCondition(event, value);
    }

    const builtin = this._conditions[conditionName];
    if (!builtin) {
      throw new Error(`Unknown condition: "${conditionName}"`);
    }

    return await builtin(event, value);
  }

  /**
   * Plugins call this to register new conditions
   */
  registerCondition(name, fn) {
    this._conditions[name] = fn;
  }
}
