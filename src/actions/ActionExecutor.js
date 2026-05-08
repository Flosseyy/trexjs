/**
 * ActionExecutor
 * Runs THEN actions defined in a rule.
 * Each action is a named handler that receives the action config + event.
 */

import { createLogger } from '../logger/logger.js';

const log = createLogger('ActionExecutor');

export class ActionExecutor {
  constructor(pluginRegistry) {
    this.plugins = pluginRegistry;

    // Built-in action handlers
    this._actions = {
      reply: async (config, event) => {
        if (!event.reply) throw new Error('"reply" not available for this event type');
        await event.reply(config.text);
        log.info(`Action: reply → "${config.text}"`);
      },

      sendMessage: async (config, event) => {
        const channel = config.channelId
          ? event.raw.client?.channels.cache.get(config.channelId)
          : event.raw.channel;
        await channel?.send(config.text);
        log.info(`Action: sendMessage → "${config.text}"`);
      },

      deleteMessage: async (_config, event) => {
        if (event.delete) await event.delete();
        log.info('Action: deleteMessage');
      },

      addRole: async (config, event) => {
        const member = event.member ?? event.raw.member;
        if (!member) throw new Error('"addRole" requires a guild member event');
        const role = member.guild.roles.cache.find(r => r.name === config.role);
        if (role) await member.roles.add(role);
        log.info(`Action: addRole → "${config.role}"`);
      },

      removeRole: async (config, event) => {
        const member = event.member ?? event.raw.member;
        if (!member) throw new Error('"removeRole" requires a guild member event');
        const role = member.guild.roles.cache.find(r => r.name === config.role);
        if (role) await member.roles.remove(role);
        log.info(`Action: removeRole → "${config.role}"`);
      },

      timeoutUser: async (config, event) => {
        const member = event.member ?? event.raw.member;
        if (!member) throw new Error('"timeoutUser" requires a guild member event');
        const duration = config.duration ?? 60_000; // ms, default 1 min
        await member.timeout(duration, config.reason ?? 'Rule triggered timeout');
        log.info(`Action: timeoutUser for ${duration}ms`);
      },

      dmUser: async (config, event) => {
        const user = event.raw.author ?? event.raw.user;
        await user?.send(config.text);
        log.info(`Action: dmUser → "${config.text}"`);
      },

      log: async (config, event) => {
        log.info(`[Rule log] ${config.message ?? JSON.stringify(event)}`);
      },
    };
  }

  async execute(actionConfig, event) {
    const { action, ...config } = actionConfig;

    // Plugin actions take priority
    const pluginAction = this.plugins.getAction(action);
    if (pluginAction) {
      return await pluginAction(config, event);
    }

    const builtin = this._actions[action];
    if (!builtin) {
      throw new Error(`Unknown action: "${action}"`);
    }

    await builtin(config, event);
  }

  /**
   * Plugins call this to register new actions
   */
  registerAction(name, fn) {
    this._actions[name] = fn;
  }
}
