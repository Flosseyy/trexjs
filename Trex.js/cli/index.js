#!/usr/bin/env node

import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { default: chalk }    = await import('chalk');
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

  const { lang } = await inquirer.prompt([{
    type: 'list',
    name: 'lang',
    message: 'Which language do you want to use?',
    choices: [
      { name: 'JavaScript', value: 'js' },
      { name: 'TypeScript', value: 'ts' },
    ],
  }]);

  const { storage } = await inquirer.prompt([{
    type: 'list',
    name: 'storage',
    message: 'Storage backend:',
    choices: [
      { name: 'JSON files (simple)', value: 'json' },
      { name: 'MongoDB',             value: 'mongo' },
    ],
  }]);

  const { features } = await inquirer.prompt([{
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
  }]);

  const dir = path.resolve(process.cwd(), name);
  if (existsSync(dir)) {
    console.error(chalk.red(`Directory "${name}" already exists.`));
    process.exit(1);
  }

  console.log(chalk.cyan(`\nScaffolding ${chalk.bold(name)} (${lang.toUpperCase()})...\n`));

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

  await writeFile(`${dir}/.env`, [
    'DISCORD_TOKEN=your_token_here',
    'CLIENT_ID=your_client_id_here',
    storage === 'mongo' ? 'MONGO_URI=mongodb://localhost:27017/mybot' : '',
  ].filter(Boolean).join('\n'));

  await writeFile(`${dir}/.gitignore`, 'node_modules\n.env\ndata/\ndist/\n');

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

  const storageImport = storage === 'mongo'
    ? `import { MongoStorage } from 'trexjs/persistence/mongo';\nconst storage = new MongoStorage(process.env.MONGO_URI);`
    : `import { JsonStorage } from 'trexjs';\nconst storage = new JsonStorage('./data');`;

  await writeFile(`${dir}/src/bot.${lang}`,                          lang === 'ts' ? generateBotFileTs(features, storageImport) : generateBotFileJs(features, storageImport));
  await writeFile(`${dir}/src/commands/ping.${lang}`,                generateCommandFile(lang));
  await writeFile(`${dir}/src/events/ready.${lang}`,                 generateEventFile(lang));
  await writeFile(`${dir}/src/preconditions/GuildOnly.${lang}`,      generatePreconditionFile(lang));
  if (features.includes('i18n')) await writeFile(`${dir}/locales/en-US.${lang}`, generateLocaleFile(lang));
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
  if (!type) {
    console.error(chalk.red('Usage: trex add <command|event|precondition> <name>'));
    process.exit(1);
  }

  if (type === 'command') {
    await cmdAddCommand(name);
    return;
  }

  const lang = existsSync('./tsconfig.json') ? 'ts' : 'js';

  const targets = {
    event:        { dir: './src/events',        gen: generateEventFile },
    precondition: { dir: './src/preconditions', gen: generatePreconditionFile },
  };

  const target = targets[type];
  if (!target) {
    console.error(chalk.red(`Unknown type: ${type}. Use command, event, or precondition.`));
    process.exit(1);
  }

  if (!name) {
    console.error(chalk.red(`Usage: trex add ${type} <name>`));
    process.exit(1);
  }

  const filePath = path.join(target.dir, `${name}.${lang}`);
  if (existsSync(filePath)) {
    console.error(chalk.red(`File already exists: ${filePath}`));
    process.exit(1);
  }

  if (!existsSync(target.dir)) await mkdir(target.dir, { recursive: true });
  await writeFile(filePath, target.gen(lang, name));
  console.log(chalk.green(`✅  Created: ${filePath}`));
}

// ─── trex add command (interactive) ──────────────────────────────────────────

async function cmdAddCommand(nameArg) {
  const lang = existsSync('./tsconfig.json') ? 'ts' : 'js';

  console.log(chalk.cyan("\n  🦖 Let's build a new command\n"));

  const { cmdName } = await inquirer.prompt([{
    type: 'input',
    name: 'cmdName',
    message: 'What do you want to call it?',
    default: nameArg || undefined,
    filter: v => v.toLowerCase().trim().replace(/\s+/g, '-'),
    validate: v => v.length > 0 || 'Give it a name',
  }]);

  const { cmdDesc } = await inquirer.prompt([{
    type: 'input',
    name: 'cmdDesc',
    message: 'What does it do? (shows up in Discord when someone hovers it)',
    validate: v => v.trim().length > 0 || 'Add a description',
  }]);

  const optionTypes = [
    { name: 'A user   — ping/target someone',  value: 'USER' },
    { name: 'Text     — a message or reason',   value: 'STRING' },
    { name: 'Number   — a count or amount',     value: 'INTEGER' },
    { name: 'Yes/No   — a toggle',              value: 'BOOLEAN' },
    { name: 'Channel  — pick a channel',        value: 'CHANNEL' },
    { name: 'Role     — pick a role',           value: 'ROLE' },
  ];

  const options = [];
  let addingOptions = true;

  while (addingOptions) {
    const { wantsOption } = await inquirer.prompt([{
      type: 'confirm',
      name: 'wantsOption',
      message: options.length === 0 ? 'Does it need any inputs from the user?' : 'Add another input?',
      default: false,
    }]);

    if (!wantsOption) { addingOptions = false; break; }

    const opt = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What should this input be called?',
        filter: v => v.toLowerCase().trim().replace(/\s+/g, '_'),
        validate: v => v.length > 0 || 'Give it a name',
      },
      {
        type: 'list',
        name: 'type',
        message: 'What kind of input is it?',
        choices: optionTypes,
      },
      {
        type: 'input',
        name: 'description',
        message: 'Short description for this input:',
        validate: v => v.trim().length > 0 || 'Add a description',
      },
      {
        type: 'confirm',
        name: 'required',
        message: 'Is this required?',
        default: true,
      },
    ]);

    options.push(opt);
  }

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What should it actually do?',
    choices: [
      { name: 'Just send a message back',     value: 'reply' },
      { name: 'Ban someone',                  value: 'ban' },
      { name: 'Kick someone',                 value: 'kick' },
      { name: 'Timeout / mute someone',       value: 'timeout' },
      { name: 'Send an embed',                value: 'embed' },
      { name: 'DM someone',                   value: 'dm' },
      { name: 'Give someone a role',          value: 'role' },
      { name: 'Log a warning',                value: 'warn' },
      { name: "I'll write the logic myself",  value: 'custom' },
    ],
  }]);

  const extras = await inquirer.prompt([
    {
      type: 'number',
      name: 'cooldown',
      message: 'Cooldown between uses? (seconds, 0 = none)',
      default: 0,
    },
    {
      type: 'confirm',
      name: 'guildOnly',
      message: 'Server-only? (blocks DMs)',
      default: true,
    },
    {
      type: 'confirm',
      name: 'ephemeral',
      message: 'Should the reply be visible only to the user who ran it?',
      default: false,
    },
  ]);

  const { wantsToCode } = await inquirer.prompt([{
    type: 'confirm',
    name: 'wantsToCode',
    message: 'Open the file in your editor when done?',
    default: false,
  }]);

  const dir      = './src/commands';
  const filePath = `${dir}/${cmdName}.${lang}`;

  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  if (existsSync(filePath)) {
    console.error(chalk.red(`File already exists: ${filePath}`));
    process.exit(1);
  }

  await writeFile(filePath, generateFullCommand({ lang, cmdName, cmdDesc, options, action, extras }));
  console.log(chalk.green(`\n✅  Created: ${filePath}`));

  if (wantsToCode) {
    const editor = process.env.EDITOR || (os.platform() === 'win32' ? 'notepad' : 'nano');
    try {
      execSync(`${editor} ${filePath}`, { stdio: 'inherit' });
    } catch {
      console.log(chalk.yellow(`Couldn't open editor — just open ${filePath} yourself.`));
    }
  }

  console.log(chalk.cyan('\n  💡 Some ideas for your next command:\n'));
  suggestCommands(action);
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

// ─── Command file generator ───────────────────────────────────────────────────

function generateFullCommand({ lang, cmdName, cmdDesc, options, action, extras }) {
  const typeMap = {
    STRING:  'addStringOption',
    INTEGER: 'addIntegerOption',
    USER:    'addUserOption',
    BOOLEAN: 'addBooleanOption',
    CHANNEL: 'addChannelOption',
    ROLE:    'addRoleOption',
  };

  const optionLines = options.map(o =>
    `    .${typeMap[o.type] || 'addStringOption'}(option =>\n      option\n        .setName('${o.name}')\n        .setDescription('${o.description}')\n        .setRequired(${o.required}))`
  ).join('\n');

  const firstUser   = options.find(o => o.type === 'USER');
  const firstString = options.find(o => o.type === 'STRING');
  const userVar     = firstUser   ? `    const target = interaction.options.getUser('${firstUser.name}');\n` : '';
  const reasonVar   = firstString ? `    const reason = interaction.options.getString('${firstString.name}') ?? 'No reason provided';\n` : '';
  const ephem       = `ephemeral: ${extras.ephemeral}`;

  let body;
  switch (action) {
    case 'reply':
      body = `${userVar}    await interaction.reply({ content: 'Done!', ${ephem} });`;
      break;
    case 'ban':
      body = `${userVar}${reasonVar}    const member = await interaction.guild.members.fetch(target.id);\n    await member.ban({ reason });\n    await interaction.reply({ content: \`✅ Banned **\${target.tag}**\`, ${ephem} });`;
      break;
    case 'kick':
      body = `${userVar}${reasonVar}    const member = await interaction.guild.members.fetch(target.id);\n    await member.kick(reason);\n    await interaction.reply({ content: \`✅ Kicked **\${target.tag}**\`, ${ephem} });`;
      break;
    case 'timeout':
      body = `${userVar}${reasonVar}    const member = await interaction.guild.members.fetch(target.id);\n    await member.timeout(10 * 60 * 1000, reason);\n    await interaction.reply({ content: \`✅ Timed out **\${target.tag}** for 10 minutes\`, ${ephem} });`;
      break;
    case 'embed':
      body = `    const embed = new EmbedBuilder()\n      .setTitle('${cmdName}')\n      .setDescription('Your content here')\n      .setColor(0x5865F2);\n    await interaction.reply({ embeds: [embed], ${ephem} });`;
      break;
    case 'dm':
      body = `${userVar}    await target.send('Message from the bot!');\n    await interaction.reply({ content: \`✅ DM sent to **\${target.tag}**\`, ${ephem} });`;
      break;
    case 'role':
      body = `${userVar}    const member = await interaction.guild.members.fetch(target.id);\n    const role = interaction.guild.roles.cache.find(r => r.name === 'RoleName');\n    if (!role) return interaction.reply({ content: 'Role not found.', ${ephem} });\n    await member.roles.add(role);\n    await interaction.reply({ content: \`✅ Gave **\${role.name}** to **\${target.tag}**\`, ${ephem} });`;
      break;
    case 'warn':
      body = `${userVar}${reasonVar}    console.log(\`[WARN] \${target.tag} — \${reason}\`);\n    await interaction.reply({ content: \`⚠️ Warned **\${target.tag}**: \${reason}\`, ${ephem} });`;
      break;
    default:
      body = `    await interaction.reply({ content: 'Done!', ${ephem} });`;
  }

  const embedImport    = action === 'embed' ? ', EmbedBuilder' : '';
  const cooldownLines  = extras.cooldown > 0 ? `\n  cooldown: ${extras.cooldown * 1000},\n  cooldownScope: 'user',` : '';
  const precondLines   = extras.guildOnly ? `\n  preconditions: ['GuildOnly'],` : '';

  const dataBlock = options.length
    ? `new SlashCommandBuilder()\n    .setName('${cmdName}')\n    .setDescription('${cmdDesc}')\n${optionLines}`
    : `new SlashCommandBuilder()\n    .setName('${cmdName}')\n    .setDescription('${cmdDesc}')`;

  const indentedBody = body.split('\n').map(l => '      ' + l).join('\n');

  if (lang === 'ts') {
    return `import { SlashCommandBuilder${embedImport} } from 'discord.js';
import type { TrexCommand, CommandContext } from 'trexjs';

const command: TrexCommand = {
  data: ${dataBlock},
${cooldownLines}${precondLines}

  async run({ interaction, client }: CommandContext): Promise<void> {
    try {
${indentedBody}
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
    }
  },
};

export default command;
`;
  }

  return `import { SlashCommandBuilder${embedImport} } from 'discord.js';

/** @type {import('trexjs').TrexCommand} */
const command = {
  data: ${dataBlock},
${cooldownLines}${precondLines}

  async run({ interaction, client }) {
    try {
${indentedBody}
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
    }
  },
};

export default command;
`;
}

// ─── Post-creation suggestions ────────────────────────────────────────────────

function suggestCommands(action) {
  const all = [
    { cmd: '/purge <amount>',          desc: 'Bulk delete messages from a channel' },
    { cmd: '/userinfo <user>',         desc: 'Show join date, roles, and account age' },
    { cmd: '/slowmode <seconds>',      desc: 'Set channel slowmode on the fly' },
    { cmd: '/poll <question>',         desc: 'Start a quick ✅/❌ reaction poll' },
    { cmd: '/softban <user>',          desc: 'Ban then instantly unban to wipe messages' },
    { cmd: '/warnings <user>',         desc: "Pull up a user's warning history" },
    { cmd: '/giveaway <prize> <time>', desc: 'Start a timed giveaway in the current channel' },
    { cmd: '/afk <reason>',            desc: "Set an AFK status that replies when you're pinged" },
    { cmd: '/serverinfo',              desc: 'Show member count, boost level, and server stats' },
    { cmd: '/avatar <user>',           desc: "Pull up someone's full-size avatar" },
    { cmd: '/lock',                    desc: 'Lock a channel so only mods can talk' },
    { cmd: '/unban <userId>',          desc: 'Unban someone by their user ID' },
  ];

  const modActions = ['ban', 'kick', 'timeout', 'warn'];
  const modPicks   = ['/purge', '/warnings', '/softban', '/lock', '/unban'];

  const picks = modActions.includes(action)
    ? all.filter(i => modPicks.some(s => i.cmd.startsWith(s)))
    : all.filter(i => !modPicks.some(s => i.cmd.startsWith(s)));

  picks.slice(0, 5).forEach(({ cmd, desc }) => {
    console.log(`  ${chalk.bold(chalk.cyan(cmd.padEnd(30)))} ${chalk.gray(desc)}`);
  });

  console.log();
}

// ─── Template generators ──────────────────────────────────────────────────────

function generateBotFileJs(features, storageImport) {
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

function generateBotFileTs(features, storageImport) {
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

  cooldown: 5000,
  cooldownScope: 'user',
  preconditions: ['GuildOnly'],

  async run({ interaction, client }: CommandContext): Promise<void> {
    const start = Date.now();
    await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
    await interaction.editReply(\`🏓 Pong! Latency: **\${Date.now() - start}ms** | API: **\${Math.round(client.ws.ping)}ms**\`);
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

  cooldown: 5000,
  cooldownScope: 'user',
  preconditions: ['GuildOnly'],

  async run({ interaction, client }) {
    const start = Date.now();
    await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
    await interaction.editReply(\`🏓 Pong! Latency: **\${Date.now() - start}ms** | API: **\${Math.round(client.ws.ping)}ms**\`);
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
    'errors.onCooldown':         'Please wait {seconds}s before using this command again.',
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
  bot.${lang}
  commands/
    ping.${lang}
  events/
    ready.${lang}
  preconditions/
    GuildOnly.${lang}
  plugins/
\`\`\`

## Adding a command

\`\`\`bash
npx trex add command mycommand
\`\`\`

## Running

\`\`\`bash
npm run dev
npm run start
\`\`\`
`;
}
