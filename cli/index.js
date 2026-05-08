#!/usr/bin/env node
/**
 * Trex.js v2 CLI
 *
 * Usage:
 *   trex create my-bot       → scaffold a new bot project (prompts for JS or TS)
 *   trex add command <name>  → add a new command file
 *   trex add event <name>    → add a new event file
 *   trex add precondition <name>  → add a new precondition file
 *   trex sync [guildId]      → sync slash commands with Discord
 */

import { createRequire } from 'module';
import path from 'path';
import { mkdir, writeFile, readFile, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dynamically import chalk and inquirer (ESM-only)
const { default: chalk } = await import('chalk');
const { default: inquirer } = await import('inquirer');

const [,, command, ...args] = process.argv;

switch (command) {
  case 'create': await cmdCreate(args[0]); break;
  case 'add':    await cmdAdd(args[0], args[1]); break;
  case 'sync':   await cmdSync(args[0]); break;
  default:
    console.log(chalk.cyan(`
  🦖 Trex.js v2

  ${chalk.bold('Commands:')}
    trex create <name>              Create a new bot project
    trex add command <name>         Add a command file
    trex add event <name>           Add an event file
    trex add precondition <name>    Add a precondition file
    trex sync [guildId]             Sync slash commands with Discord
`));
}

// ─── trex create ─────────────────────────────────────────────────────────────

async function cmdCreate(name) {
  if (!name) {
    console.error(chalk.red('Usage: trex create <project-name>'));
    process.exit(1);
  }

  const { lang } = await inquirer.prompt([
    {
      type: 'list',
      name: 'lang',
      message: 'Which language do you want to use?',
      choices: [
        { name: 'JavaScript', value: 'js' },
        { name: 'TypeScript', value: 'ts' },
      ],
    },
  ]);

  const { storage } = await inquirer.prompt([
    {
      type: 'list',
      name: 'storage',
      message: 'Storage backend:',
      choices: [
        { name: 'JSON files (simple)', value: 'json' },
        { name: 'MongoDB',             value: 'mongo' },
      ],
    },
  ]);

  const { features } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'features',
      message: 'Which features do you want included?',
      choices: [
        { name: 'Moderation plugin', value: 'moderation', checked: true },
        { name: 'Voice audio',       value: 'voice' },
        { name: 'Pagination helper', value: 'pagination', checked: true },
        { name: 'i18n support',      value: 'i18n' },
        { name: 'Hot reload (dev)',   value: 'hotReload', checked: true },
      ],
    },
  ]);

  const dir = path.resolve(process.cwd(), name);
  if (existsSync(dir)) {
    console.error(chalk.red(`Directory "${name}" already exists.`));
    process.exit(1);
  }

  console.log(chalk.cyan(`\nScaffolding ${chalk.bold(name)} (${lang.toUpperCase()})...\n`));

  const ext = lang; // 'js' or 'ts'

  // Create directory structure
  const dirs = [
    dir,
    `${dir}/src/commands`,
    `${dir}/src/events`,
    `${dir}/src/preconditions`,
    `${dir}/src/plugins`,
    `${dir}/data`,
  ];

  if (features.includes('i18n')) dirs.push(`${dir}/locales`);

  for (const d of dirs) await mkdir(d, { recursive: true });

  // ── package.json ──
  const pkg = {
    name,
    version: '1.0.0',
    type: 'module',
    scripts: {
      start: lang === 'ts' ? 'node --loader ts-node/esm src/bot.ts' : 'node src/bot.js',
      dev:   lang === 'ts' ? 'node --watch --loader ts-node/esm src/bot.ts' : 'node --watch src/bot.js',
    },
    dependencies: {
      trexjs: '^2.0.0',
      dotenv: '^16.3.1',
      ...(storage === 'mongo' ? { mongoose: '^8.0.0' } : {}),
    },
    ...(lang === 'ts' ? {
      devDependencies: {
        typescript: '^5.3.0',
        'ts-node': '^10.9.2',
        '@types/node': '^20.0.0',
      },
    } : {}),
  };

  await writeFile(`${dir}/package.json`, JSON.stringify(pkg, null, 2));

  // ── .env ──
  await writeFile(`${dir}/.env`, [
    `DISCORD_TOKEN=your_token_here`,
    `CLIENT_ID=your_client_id_here`,
    storage === 'mongo' ? 'MONGO_URI=mongodb://localhost:27017/mybot' : '',
  ].filter(Boolean).join('\n'));

  // ── .gitignore ──
  await writeFile(`${dir}/.gitignore`, 'node_modules\n.env\ndata/\ndist/\n');

  // ── tsconfig.json (TypeScript only) ──
  if (lang === 'ts') {
    await writeFile(`${dir}/tsconfig.json`, JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        outDir: './dist',
      },
      include: ['src/**/*'],
    }, null, 2));
  }

  // ── Main bot file ──
  const storageImport = storage === 'mongo'
    ? `import { MongoStorage } from 'trexjs/persistence/mongo';\nconst storage = new MongoStorage(process.env.MONGO_URI);`
    : `import { JsonStorage } from 'trexjs';\nconst storage = new JsonStorage('./data');`;

  const botFile = lang === 'ts'
    ? generateBotFileTs(features, storageImport, storage)
    : generateBotFileJs(features, storageImport, storage);

  await writeFile(`${dir}/src/bot.${ext}`, botFile);

  // ── Example command ──
  await writeFile(
    `${dir}/src/commands/ping.${ext}`,
    generateCommandFile(lang)
  );

  // ── Example event ──
  await writeFile(
    `${dir}/src/events/ready.${ext}`,
    generateEventFile(lang)
  );

  // ── Example precondition ──
  await writeFile(
    `${dir}/src/preconditions/GuildOnly.${ext}`,
    generatePreconditionFile(lang)
  );

  // ── i18n locale ──
  if (features.includes('i18n')) {
    await writeFile(`${dir}/locales/en-US.${ext}`, generateLocaleFile(lang));
  }

  // ── README ──
  await writeFile(`${dir}/README.md`, generateReadme(name, lang, features));

  console.log(chalk.green('✅  Project created!\n'));
  console.log(`  ${chalk.bold('Next steps:')}`);
  console.log(`  ${chalk.cyan('cd')} ${name}`);
  console.log(`  ${chalk.cyan('npm install')}`);
  console.log(`  ${chalk.cyan('# Edit .env with your Discord token')}`);
  console.log(`  ${chalk.cyan('npm run dev')}\n`);
}

// ─── trex add ────────────────────────────────────────────────────────────────

async function cmdAdd(type, name) {
  if (!type || !name) {
    console.error(chalk.red('Usage: trex add <command|event|precondition> <name>'));
    process.exit(1);
  }

  // Detect language from tsconfig presence
  const lang = existsSync('./tsconfig.json') ? 'ts' : 'js';
  const ext  = lang;

  const targets = {
    command:      { dir: './src/commands',      gen: generateCommandFile },
    event:        { dir: './src/events',        gen: generateEventFile },
    precondition: { dir: './src/preconditions', gen: generatePreconditionFile },
  };

  const target = targets[type];
  if (!target) {
    console.error(chalk.red(`Unknown type: ${type}. Use command, event, or precondition.`));
    process.exit(1);
  }

  const fileName = `${name}.${ext}`;
  const filePath = path.join(target.dir, fileName);

  if (existsSync(filePath)) {
    console.error(chalk.red(`File already exists: ${filePath}`));
    process.exit(1);
  }

  if (!existsSync(target.dir)) await mkdir(target.dir, { recursive: true });

  await writeFile(filePath, target.gen(lang, name));
  console.log(chalk.green(`✅  Created: ${filePath}`));
}

// ─── trex sync ───────────────────────────────────────────────────────────────

async function cmdSync(guildId) {
  console.log(chalk.cyan('Syncing slash commands...'));
  try {
    const { default: bot } = await import(path.resolve('./src/bot.js'));
    await bot.syncCommands(guildId);
    console.log(chalk.green('✅  Commands synced!'));
  } catch (err) {
    console.error(chalk.red(`Sync failed: ${err.message}`));
    process.exit(1);
  }
}

// ─── Template generators ─────────────────────────────────────────────────────

function generateBotFileJs(features, storageImport, storage) {
  return `import { createTrex } from 'trexjs';
${storageImport}
${features.includes('moderation') ? "import { moderationPlugin } from 'trexjs/plugins/moderation';" : ''}

const bot = createTrex({
  storage,
  commandsDir:      './src/commands',
  eventsDir:        './src/events',
  preconditionsDir: './src/preconditions',
  hotReload:        process.env.NODE_ENV !== 'production',
  ${features.includes('i18n') ? "localesDir: './locales'," : ''}
});

${features.includes('moderation') ? 'bot.use(moderationPlugin);' : ''}

await bot.start();

export default bot;
`;
}

function generateBotFileTs(features, storageImport, storage) {
  return `import { createTrex, TrexEngine } from 'trexjs';
${storageImport}
${features.includes('moderation') ? "import { moderationPlugin } from 'trexjs/plugins/moderation';" : ''}

const bot: TrexEngine = createTrex({
  storage,
  commandsDir:      './src/commands',
  eventsDir:        './src/events',
  preconditionsDir: './src/preconditions',
  hotReload:        process.env.NODE_ENV !== 'production',
  ${features.includes('i18n') ? "localesDir: './locales'," : ''}
});

${features.includes('moderation') ? 'bot.use(moderationPlugin);' : ''}

await bot.start();

export default bot;
`;
}

function generateCommandFile(lang, name = 'ping') {
  const cmdName = name.toLowerCase();

  if (lang === 'ts') {
    return `import { SlashCommandBuilder } from 'discord.js';
import type { TrexCommand, CommandContext } from 'trexjs';

const command: TrexCommand = {
  data: new SlashCommandBuilder()
    .setName('${cmdName}')
    .setDescription('Replies with Pong!'),

  // preconditions: ['GuildOnly'],  // Uncomment to enable
  // cooldown: 5000,                // 5 second cooldown
  // cooldownScope: 'user',
  // requiredPermissions: ['SendMessages'],

  async run({ interaction, t }: CommandContext): Promise<void> {
    await interaction.reply('🏓 Pong!');
  },
};

export default command;
`;
  }

  return `import { SlashCommandBuilder } from 'discord.js';

/** @type {import('trexjs').TrexCommand} */
const command = {
  data: new SlashCommandBuilder()
    .setName('${cmdName}')
    .setDescription('Replies with Pong!'),

  // preconditions: ['GuildOnly'],  // Uncomment to enable
  // cooldown: 5000,                // 5 second cooldown
  // cooldownScope: 'user',
  // requiredPermissions: ['SendMessages'],

  async run({ interaction, t }) {
    await interaction.reply('🏓 Pong!');
  },
};

export default command;
`;
}

function generateEventFile(lang, name = 'ready') {
  if (lang === 'ts') {
    return `import type { TrexEvent } from 'trexjs';
import { Client } from 'discord.js';

const event: TrexEvent<Client> = {
  name: 'ready',
  event: 'ready',
  once: true,

  async run({ data: client }): Promise<void> {
    console.log(\`✅ Logged in as \${client.user?.tag}\`);
  },
};

export default event;
`;
  }

  return `/** @type {import('trexjs').TrexEvent} */
const event = {
  name: 'ready',
  event: 'ready',
  once: true,

  async run({ data: client }) {
    console.log(\`✅ Logged in as \${client.user?.tag}\`);
  },
};

export default event;
`;
}

function generatePreconditionFile(lang, name = 'GuildOnly') {
  if (lang === 'ts') {
    return `import type { TrexPrecondition, CommandContext } from 'trexjs';

const precondition: TrexPrecondition = {
  name: '${name}',

  run({ interaction }: CommandContext): boolean | string {
    if (!interaction.inGuild()) {
      return '❌ This command can only be used in a server.';
    }
    return true;
  },
};

export default precondition;
`;
  }

  return `/** @type {import('trexjs').TrexPrecondition} */
const precondition = {
  name: '${name}',

  run({ interaction }) {
    if (!interaction.inGuild()) {
      return '❌ This command can only be used in a server.';
    }
    return true;
  },
};

export default precondition;
`;
}

function generateLocaleFile(lang) {
  const content = {
    'errors.missingPermissions': 'You are missing the required permissions.',
    'errors.onCooldown': 'Please wait {seconds}s before using this command again.',
    'errors.preconditionFailed': 'You cannot use this command here.',
  };

  if (lang === 'ts') {
    return `const strings: Record<string, string> = ${JSON.stringify(content, null, 2)};
export default strings;
`;
  }

  return `export default ${JSON.stringify(content, null, 2)};
`;
}

function generateReadme(name, lang, features) {
  return `# ${name}

A Discord bot built with [Trex.js v2](https://github.com/yourname/trexjs).

## Stack
- Language: **${lang.toUpperCase()}**
- Features: ${features.join(', ')}

## Structure

\`\`\`
src/
  bot.${lang}               ← Entry point
  commands/              ← Slash commands (auto-discovered)
    ping.${lang}
  events/                ← Discord events (auto-discovered)
    ready.${lang}
  preconditions/         ← Command guards (auto-discovered)
    GuildOnly.${lang}
  plugins/               ← Custom plugins
\`\`\`

## Adding a command

\`\`\`bash
npx trex add command mycommand
\`\`\`

This creates \`src/commands/mycommand.${lang}\` — just fill in the handler.

## Running

\`\`\`bash
npm run dev       # Development (hot reload)
npm run start     # Production
\`\`\`
`;
}
