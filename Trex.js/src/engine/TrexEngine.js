/**
 * Trex.js v2 — Core Engine
 *
 * New in v2:
 *  - Auto-discovers commands, events, and preconditions from directories
 *  - Slash command auto-registration with Discord API
 *  - Preconditions pipeline
 *  - Cooldown system (user/channel/guild scoped)
 *  - Discord permission validation
 *  - Hot reload (file watcher)
 *  - i18n support
 *  - Voice audio playback
 *  - Pagination helper
 *  - Full TypeScript types
 */

import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import path from 'path';
import { pathToFileURL } from 'url';

import { CommandRegistry } from '../commands/CommandRegistry.js';
import { EventLoader } from '../events/EventLoader.js';
import { PreconditionRegistry } from '../preconditions/PreconditionRegistry.js';
import { CooldownManager } from '../cooldowns/CooldownManager.js';
import { PluginRegistry } from '../plugins/PluginRegistry.js';
import { RuleLoader } from '../rules/RuleLoader.js';
import { ConditionEvaluator } from '../rules/ConditionEvaluator.js';
import { ActionExecutor } from '../actions/ActionExecutor.js';
import { EventNormalizer } from './EventNormalizer.js';
import { JsonStorage } from '../persistence/JsonStorage.js';
import { I18nProvider } from '../i18n/I18nProvider.js';
import { FileWatcher } from '../utils/FileWatcher.js';
import { createLogger } from '../logger/logger.js';

const log = createLogger('TrexEngine');

export class TrexEngine {
  constructor(options = {}) {
    this.options = options;

    // Subsystems
    this.plugins       = new PluginRegistry();
    this.commands      = new CommandRegistry();
    this.preconditions = new PreconditionRegistry();
    this.cooldowns     = new CooldownManager();
    this.ruleLoader    = new RuleLoader(options.storage ?? new JsonStorage());
    this.condEval      = new ConditionEvaluator(this.plugins);
    this.actionExec    = new ActionExecutor(this.plugins);
    this.normalizer    = new EventNormalizer();
    this.i18n          = new I18nProvider(
      options.localesDir ?? './locales',
      options.defaultLocale ?? 'en-US'
    );

    // Discord client with all common intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this._watcher = null;
  }

  // ─── Plugin API ──────────────────────────────────────────────────────────────

  use(plugin) {
    this.plugins.register(plugin, this);

    // Register plugin-provided commands
    for (const cmd of plugin.commands ?? []) {
      this.commands.register(cmd);
    }

    // Register plugin-provided events
    for (const evt of plugin.events ?? []) {
      this._bindEvent(evt);
    }

    // Register plugin-provided preconditions
    for (const pre of plugin.preconditions ?? []) {
      this.preconditions.register(pre);
    }

    log.info(`Plugin loaded: ${plugin.name}`);
    return this; // chainable
  }

  // ─── Manual registration (code-first API) ────────────────────────────────────

  registerCommand(command) {
    this.commands.register(command);
    return this;
  }

  registerEvent(event) {
    this._bindEvent(event);
    return this;
  }

  registerPrecondition(precondition) {
    this.preconditions.register(precondition);
    return this;
  }

  // ─── Start ───────────────────────────────────────────────────────────────────

  async start(token) {
    const tok = token ?? this.options.token ?? process.env.DISCORD_TOKEN;
    if (!tok) throw new Error('No Discord token provided. Set DISCORD_TOKEN in .env or pass to start().');

    // Load i18n
    await this.i18n.load();

    // Auto-discover from directories
    await this._autoDiscover();

    // Wire the interaction handler
    this._registerCoreEvents();

    // Login
    await this.client.login(tok);
    log.info(`Trex.js v2 online as ${this.client.user?.tag}`);

    // Sync slash commands after ready
    this.client.once('ready', async () => {
      await this.syncCommands();
      log.info(`Slash commands synced. Serving ${this.client.guilds.cache.size} guild(s).`);

      // Start hot reload watcher if enabled
      if (this.options.hotReload) {
        this._startHotReload();
      }
    });
  }

  // ─── Slash command sync ───────────────────────────────────────────────────────

  async syncCommands(guildId) {
    const appId = this.client.application?.id;
    if (!appId) { log.warn('Cannot sync — client not ready yet.'); return; }

    const rest = new REST().setToken(
      this.options.token ?? process.env.DISCORD_TOKEN
    );

    const body = this.commands.getAll().map(cmd => cmd.data.toJSON());

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });
      log.info(`Synced ${body.length} commands to guild ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(appId), { body });
      log.info(`Synced ${body.length} global commands`);
    }
  }

  // ─── Auto-discovery ──────────────────────────────────────────────────────────

  async _autoDiscover() {
    const { readdir, stat } = await import('fs/promises');
    const { existsSync } = await import('fs');

    const dirs = {
      commands:      this.options.commandsDir      ?? './src/commands',
      events:        this.options.eventsDir         ?? './src/events',
      preconditions: this.options.preconditionsDir  ?? './src/preconditions',
    };

    for (const [type, dir] of Object.entries(dirs)) {
      if (!existsSync(dir)) continue;

      const files = await this._walkDir(dir);
      for (const file of files) {
        if (!file.endsWith('.js') && !file.endsWith('.ts') && !file.endsWith('.mjs')) continue;
        await this._loadFile(type, file);
      }
    }
  }

  async _walkDir(dir) {
    const { readdir, stat } = await import('fs/promises');
    const entries = await readdir(dir);
    const files = [];
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const s = await stat(full);
      if (s.isDirectory()) {
        files.push(...(await this._walkDir(full)));
      } else {
        files.push(full);
      }
    }
    return files;
  }

  async _loadFile(type, filePath) {
    try {
      const url = pathToFileURL(path.resolve(filePath)).href + `?t=${Date.now()}`;
      const mod = await import(url);
      const exported = mod.default ?? Object.values(mod)[0];
      if (!exported) return;

      if (type === 'commands') {
        this.commands.register(exported);
        log.info(`Loaded command: ${exported.data?.name ?? filePath}`);
      } else if (type === 'events') {
        this._bindEvent(exported);
        log.info(`Loaded event: ${exported.name ?? filePath}`);
      } else if (type === 'preconditions') {
        this.preconditions.register(exported);
        log.info(`Loaded precondition: ${exported.name ?? filePath}`);
      }
    } catch (err) {
      log.error(`Failed to load ${filePath}: ${err.message}`);
    }
  }

  // ─── Core Discord event wiring ───────────────────────────────────────────────

  _registerCoreEvents() {
    // Slash commands + buttons + modals
    this.client.on('interactionCreate', async (interaction) => {
      if (interaction.isChatInputCommand()) {
        await this._handleSlashCommand(interaction);
      } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
        // Pagination and custom component handlers
        this.client.emit('trex:component', interaction);
      } else if (interaction.isModalSubmit()) {
        this.client.emit('trex:modal', interaction);
      }

      // Also run through the rule engine for interactions
      const event = this.normalizer.normalize('interactionCreate', interaction);
      await this._processRuleEvent(event, interaction.guild?.id);
    });

    // Message rule engine
    this.client.on('messageCreate', async (msg) => {
      if (msg.author.bot) return;
      const event = this.normalizer.normalize('messageCreate', msg);
      await this._processRuleEvent(event, msg.guild?.id);
    });

    // Member join rule engine
    this.client.on('guildMemberAdd', async (member) => {
      const event = this.normalizer.normalize('guildMemberAdd', member);
      await this._processRuleEvent(event, member.guild.id);
    });

    // Reaction rule engine
    this.client.on('messageReactionAdd', async (reaction, user) => {
      if (user.bot) return;
      const event = this.normalizer.normalize('reactionAdd', { reaction, user });
      await this._processRuleEvent(event, reaction.message.guild?.id);
    });

    this.client.once('ready', () => {
      log.info(`Connected to Discord.`);
    });
  }

  _bindEvent(evt) {
    const method = evt.once ? 'once' : 'on';
    const t = (key, vars) => this.i18n.t(key, this.options.defaultLocale, vars);
    this.client[method](evt.event, async (...args) => {
      try {
        await evt.run({ data: args.length === 1 ? args[0] : args, client: this.client, t });
      } catch (err) {
        log.error(`Event "${evt.name}" error: ${err.message}`);
      }
    });
  }

  // ─── Slash command handler ───────────────────────────────────────────────────

  async _handleSlashCommand(interaction) {
    const command = this.commands.get(interaction.commandName);
    if (!command) return;

    const locale = interaction.locale ?? this.options.defaultLocale ?? 'en-US';
    const t = (key, vars) => this.i18n.t(key, locale, vars);
    const context = { interaction, client: this.client, t };

    // ── 1. Permission check ──
    if (command.requiredPermissions?.length) {
      const member = interaction.member;
      const missing = command.requiredPermissions.filter(
        perm => !member?.permissions.has(perm)
      );
      if (missing.length) {
        await interaction.reply({
          content: t('errors.missingPermissions') || `❌ You're missing permissions: ${missing.join(', ')}`,
          ephemeral: true,
        });
        return;
      }
    }

    // ── 2. Preconditions pipeline ──
    for (const preName of command.preconditions ?? []) {
      const pre = this.preconditions.get(preName);
      if (!pre) {
        log.warn(`Precondition "${preName}" not found for command "${command.data.name}"`);
        continue;
      }
      const result = await pre.run(context);
      if (result !== true) {
        const msg = typeof result === 'string' ? result : t('errors.preconditionFailed') || '❌ You cannot use this command here.';
        await interaction.reply({ content: msg, ephemeral: true });
        return;
      }
    }

    // ── 3. Cooldown check ──
    if (command.cooldown) {
      const scope = command.cooldownScope ?? 'user';
      const key = this.cooldowns.getKey(scope, command.data.name, interaction);
      const remaining = this.cooldowns.check(key);
      if (remaining > 0) {
        const secs = (remaining / 1000).toFixed(1);
        await interaction.reply({
          content: t('errors.onCooldown') || `⏱️ Please wait **${secs}s** before using this command again.`,
          ephemeral: true,
        });
        return;
      }
      this.cooldowns.set(key, command.cooldown);
    }

    // ── 4. Auto-defer ──
    if (command.defer) {
      await interaction.deferReply({ ephemeral: command.ephemeral ?? false });
    }

    // ── 5. Run ──
    try {
      await command.run(context);
    } catch (err) {
      log.error(`Command "${command.data.name}" failed: ${err.message}`);
      const errMsg = { content: `❌ An error occurred: ${err.message}`, ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(errMsg);
      } else {
        await interaction.reply(errMsg);
      }
    }
  }

  // ─── Rule engine pipeline ────────────────────────────────────────────────────

  async _processRuleEvent(event, guildId) {
    try {
      const rules = await this.ruleLoader.getRulesForGuild(guildId);
      const matching = rules.filter(r => r.when === event.type);
      for (const rule of matching) {
        if (!(await this.condEval.evaluate(rule.if, event))) continue;
        log.info(`Rule matched: "${rule.name ?? rule.when}" in guild ${guildId}`);
        for (const action of rule.then) {
          await this.actionExec.execute(action, event);
        }
      }
    } catch (err) {
      log.error(`Rule engine error for "${event.type}" in guild ${guildId}: ${err.message}`);
    }
  }

  // ─── Hot reload ──────────────────────────────────────────────────────────────

  _startHotReload() {
    const dirs = [
      this.options.commandsDir      ?? './src/commands',
      this.options.eventsDir        ?? './src/events',
      this.options.preconditionsDir ?? './src/preconditions',
    ];

    this._watcher = new FileWatcher(dirs, async (filePath) => {
      log.info(`Hot reload: ${filePath}`);
      const type = filePath.includes('commands') ? 'commands'
                 : filePath.includes('events') ? 'events'
                 : 'preconditions';
      await this._loadFile(type, filePath);

      // Re-sync slash commands if a command changed
      if (type === 'commands') {
        await this.syncCommands();
      }
    });

    this._watcher.start();
    log.info('Hot reload enabled — watching for file changes.');
  }
}
