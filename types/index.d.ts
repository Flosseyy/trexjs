import {
  Client,
  CommandInteraction,
  Message,
  GuildMember,
  MessageReaction,
  User,
  VoiceState,
  ButtonInteraction,
  SelectMenuInteraction,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  PermissionResolvable,
  TextChannel,
  VoiceChannel,
} from 'discord.js';

// ─── Core Engine ──────────────────────────────────────────────────────────────

export interface TrexOptions {
  /** Token to use — defaults to DISCORD_TOKEN env var */
  token?: string;
  /** Storage adapter for rules and guild configs */
  storage?: StorageAdapter;
  /** Directory to auto-discover commands (default: ./src/commands) */
  commandsDir?: string;
  /** Directory to auto-discover events (default: ./src/events) */
  eventsDir?: string;
  /** Directory to auto-discover preconditions (default: ./src/preconditions) */
  preconditionsDir?: string;
  /** Watch mode — hot-reload commands/events on file change */
  hotReload?: boolean;
  /** Default locale for i18n (default: 'en-US') */
  defaultLocale?: string;
  /** Path to i18n locales directory */
  localesDir?: string;
}

export function createTrex(options?: TrexOptions): TrexEngine;

export class TrexEngine {
  client: Client;
  commands: CommandRegistry;
  i18n: I18nProvider;

  constructor(options?: TrexOptions);

  /** Register a plugin */
  use(plugin: TrexPlugin): this;

  /** Start the bot */
  start(token?: string): Promise<void>;

  /** Programmatically register a slash command */
  registerCommand(command: TrexCommand): this;

  /** Programmatically register an event handler */
  registerEvent(event: TrexEvent): this;

  /** Sync slash commands with Discord API */
  syncCommands(guildId?: string): Promise<void>;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export interface TrexCommand {
  /** The slash command definition */
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  /** Preconditions that must all pass before run() is called */
  preconditions?: string[];
  /** Cooldown in milliseconds */
  cooldown?: number;
  /** Cooldown scope: 'user' | 'channel' | 'guild' */
  cooldownScope?: 'user' | 'channel' | 'guild';
  /** Required Discord permissions */
  requiredPermissions?: PermissionResolvable[];
  /** Whether to defer the reply automatically */
  defer?: boolean;
  /** Whether the deferred reply should be ephemeral */
  ephemeral?: boolean;
  /** The command handler */
  run(context: CommandContext): Promise<void> | void;
}

export interface CommandContext {
  interaction: CommandInteraction;
  client: Client;
  /** Localized string helper */
  t(key: string, vars?: Record<string, string | number>): string;
}

export class CommandRegistry {
  register(command: TrexCommand): void;
  get(name: string): TrexCommand | undefined;
  getAll(): TrexCommand[];
  sync(client: Client, guildId?: string): Promise<void>;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export interface TrexEvent<T = unknown> {
  name: string;
  /** Discord.js event name */
  event: string;
  /** Only fire once */
  once?: boolean;
  run(context: EventContext<T>): Promise<void> | void;
}

export interface EventContext<T = unknown> {
  data: T;
  client: Client;
  t(key: string, vars?: Record<string, string | number>): string;
}

// ─── Preconditions ────────────────────────────────────────────────────────────

export interface TrexPrecondition {
  name: string;
  /** Return true to allow, false/string to deny (string is the error message) */
  run(context: CommandContext): Promise<boolean | string> | boolean | string;
}

// ─── Cooldowns ────────────────────────────────────────────────────────────────

export interface CooldownOptions {
  duration: number;
  scope: 'user' | 'channel' | 'guild';
}

// ─── Plugins ──────────────────────────────────────────────────────────────────

export interface TrexPlugin {
  name: string;
  commands?: TrexCommand[];
  events?: TrexEvent[];
  preconditions?: TrexPrecondition[];
  actions?: Record<string, ActionHandler>;
  conditions?: Record<string, ConditionHandler>;
  setup?(engine: TrexEngine): void | Promise<void>;
}

// ─── Rules (no-code engine) ───────────────────────────────────────────────────

export interface TrexRule {
  name?: string;
  when: string;
  if?: Record<string, unknown>;
  then: ActionConfig[];
}

export interface ActionConfig {
  action: string;
  [key: string]: unknown;
}

export type ActionHandler = (config: Record<string, unknown>, event: NormalizedEvent) => Promise<void> | void;
export type ConditionHandler = (event: NormalizedEvent, value: unknown) => Promise<boolean> | boolean;

export interface NormalizedEvent {
  type: string;
  raw: unknown;
  content?: string;
  authorId?: string;
  authorTag?: string;
  channelId?: string;
  guildId?: string;
  roles?: string[];
  reply?(text: string): Promise<unknown>;
  send?(text: string): Promise<unknown>;
  delete?(): Promise<unknown>;
  member?: GuildMember;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export interface StorageAdapter {
  loadRules(guildId: string): Promise<TrexRule[]>;
  saveRules(guildId: string, rules: TrexRule[]): Promise<void>;
  loadConfig(guildId: string): Promise<Record<string, unknown>>;
  saveConfig(guildId: string, config: Record<string, unknown>): Promise<void>;
}

export class JsonStorage implements StorageAdapter {
  constructor(dataDir?: string);
  loadRules(guildId: string): Promise<TrexRule[]>;
  saveRules(guildId: string, rules: TrexRule[]): Promise<void>;
  loadConfig(guildId: string): Promise<Record<string, unknown>>;
  saveConfig(guildId: string, config: Record<string, unknown>): Promise<void>;
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

export class I18nProvider {
  constructor(localesDir: string, defaultLocale?: string);
  t(key: string, locale?: string, vars?: Record<string, string | number>): string;
  load(): Promise<void>;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationOptions {
  pages: import('discord.js').EmbedBuilder[];
  interaction: CommandInteraction;
  /** Timeout in ms (default: 60000) */
  timeout?: number;
  /** Whether to delete buttons after timeout */
  deleteOnTimeout?: boolean;
}

export function paginate(options: PaginationOptions): Promise<void>;

// ─── Voice ────────────────────────────────────────────────────────────────────

export interface VoicePlayerOptions {
  channel: VoiceChannel;
  client: Client;
}

export class VoicePlayer {
  constructor(options: VoicePlayerOptions);
  play(source: string | import('stream').Readable): void;
  pause(): void;
  resume(): void;
  stop(): void;
  disconnect(): void;
  on(event: 'end' | 'error' | 'start', listener: (...args: unknown[]) => void): this;
}

// ─── Logger ───────────────────────────────────────────────────────────────────

export function createLogger(name: string): {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
};
