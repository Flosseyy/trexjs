/**
 * Trex.js Core Engine
 * Orchestrates: event listening → rule matching → condition evaluation → action execution
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { RuleLoader } from '../rules/RuleLoader.js';
import { ConditionEvaluator } from '../rules/ConditionEvaluator.js';
import { ActionExecutor } from '../actions/ActionExecutor.js';
import { EventNormalizer } from './EventNormalizer.js';
import { PluginRegistry } from '../plugins/PluginRegistry.js';
import { createLogger } from '../logger/logger.js';

const log = createLogger('TrexEngine');

export class TrexEngine {
  constructor(options = {}) {
    this.options = options;
    this.plugins = new PluginRegistry();
    this.ruleLoader = new RuleLoader(options.storage);
    this.conditionEvaluator = new ConditionEvaluator(this.plugins);
    this.actionExecutor = new ActionExecutor(this.plugins);
    this.normalizer = new EventNormalizer();

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
      ],
    });

    this._registerDiscordEvents();
  }

  /**
   * Register a plugin: trex.use(moderationPlugin)
   */
  use(plugin) {
    this.plugins.register(plugin);
    log.info(`Plugin loaded: ${plugin.name}`);
    return this; // chainable
  }

  /**
   * Start the bot
   */
  async start(token) {
    await this.client.login(token || process.env.DISCORD_TOKEN);
    log.info(`Trex.js online as ${this.client.user?.tag}`);
  }

  /**
   * Wire Discord.js events into Trex's internal event bus
   */
  _registerDiscordEvents() {
    this.client.on('messageCreate', (msg) => {
      if (msg.author.bot) return;
      const event = this.normalizer.normalize('messageCreate', msg);
      this._processEvent(event, msg.guild?.id);
    });

    this.client.on('guildMemberAdd', (member) => {
      const event = this.normalizer.normalize('guildMemberAdd', member);
      this._processEvent(event, member.guild.id);
    });

    this.client.on('messageReactionAdd', (reaction, user) => {
      if (user.bot) return;
      const event = this.normalizer.normalize('reactionAdd', { reaction, user });
      this._processEvent(event, reaction.message.guild?.id);
    });

    this.client.on('interactionCreate', (interaction) => {
      const event = this.normalizer.normalize('interactionCreate', interaction);
      this._processEvent(event, interaction.guild?.id);
    });

    this.client.once('ready', () => {
      log.info(`Connected to Discord. Serving ${this.client.guilds.cache.size} guild(s).`);
    });
  }

  /**
   * Core pipeline: load rules → match → evaluate conditions → execute actions
   */
  async _processEvent(event, guildId) {
    try {
      const rules = await this.ruleLoader.getRulesForGuild(guildId);
      const matchingRules = rules.filter(rule => rule.when === event.type);

      for (const rule of matchingRules) {
        const conditionsMet = await this.conditionEvaluator.evaluate(rule.if, event);
        if (!conditionsMet) continue;

        log.info(`Rule matched: "${rule.name || rule.when}" in guild ${guildId}`);

        for (const action of rule.then) {
          await this.actionExecutor.execute(action, event);
        }
      }
    } catch (err) {
      log.error(`Error processing event "${event.type}" in guild ${guildId}: ${err.message}`);
    }
  }
}
