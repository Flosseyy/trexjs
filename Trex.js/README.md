# Trex.js v2 🦖

A feature-complete Discord bot framework. Write commands in plain JS or TypeScript — your choice.

## What's new in v2

| Feature | v1 | v2 |
|---|---|---|
| Language | JS only | JS or TypeScript |
| Rules format | `.json` | `.js` / `.ts` files |
| Slash commands | Manual only | **Auto-discovered** from `src/commands/` |
| Events | Manual only | **Auto-discovered** from `src/events/` |
| Preconditions | ❌ | ✅ Full pipeline |
| Cooldowns | ❌ | ✅ User / channel / guild scoped |
| Permission checks | ❌ | ✅ Auto-validated before run |
| Hot reload | ❌ | ✅ File watcher in dev mode |
| Voice audio | ❌ | ✅ VoicePlayer class |
| Pagination | ❌ | ✅ `paginate()` helper |
| i18n | ❌ | ✅ File-based locales |
| CLI scaffolding | `trex init` | `trex create` with JS/TS choice |

## Quick start

```bash
npx trexjs create my-bot
cd my-bot
npm install
# Edit .env with your Discord token
npm run dev
```

The CLI asks you: JS or TypeScript? Storage backend? Which features?  
Then it generates the full project structure.

---

## Project structure

```
my-bot/
├── src/
│   ├── bot.js              ← Entry point
│   ├── commands/           ← Auto-discovered slash commands
│   │   └── ping.js
│   ├── events/             ← Auto-discovered event handlers
│   │   └── ready.js
│   └── preconditions/      ← Auto-discovered command guards
│       └── GuildOnly.js
├── locales/                ← i18n strings (optional)
│   └── en-US.js
├── data/                   ← Rule storage (JSON backend)
├── .env
└── package.json
```

---

## Writing commands

Each file in `src/commands/` is auto-discovered. Export a default object:

```js
// src/commands/greet.js
import { SlashCommandBuilder } from 'discord.js';

/** @type {import('trexjs').TrexCommand} */
export default {
  data: new SlashCommandBuilder()
    .setName('greet')
    .setDescription('Greet someone')
    .addUserOption(o => o.setName('user').setDescription('Who to greet').setRequired(true)),

  cooldown: 3000,           // 3 second cooldown
  cooldownScope: 'user',
  preconditions: ['GuildOnly'],
  requiredPermissions: ['SendMessages'],
  defer: true,              // auto-defer the reply

  async run({ interaction, t }) {
    const user = interaction.options.getUser('user');
    await interaction.editReply(`👋 Hello, ${user}!`);
  },
};
```

TypeScript version (identical, just with types):

```ts
// src/commands/greet.ts
import { SlashCommandBuilder } from 'discord.js';
import type { TrexCommand, CommandContext } from 'trexjs';

export default {
  data: new SlashCommandBuilder()
    .setName('greet')
    .setDescription('Greet someone')
    .addUserOption(o => o.setName('user').setDescription('Who').setRequired(true)),

  async run({ interaction }: CommandContext): Promise<void> {
    const user = interaction.options.getUser('user');
    await interaction.reply(`👋 Hello, ${user}!`);
  },
} satisfies TrexCommand;
```

### Adding a command via CLI

```bash
npx trex add command mycommand
```

Creates `src/commands/mycommand.js` (or `.ts` if TypeScript is detected).

---

## Preconditions

Preconditions are guards that run before a command. Return `true` to allow, or a string to deny.

```js
// src/preconditions/AdminOnly.js
export default {
  name: 'AdminOnly',
  run({ interaction }) {
    if (!interaction.member?.permissions.has('Administrator')) {
      return '❌ This command requires Administrator permissions.';
    }
    return true;
  },
};
```

Use it in any command:

```js
preconditions: ['AdminOnly'],
```

---

## Events

```js
// src/events/messageDelete.js
export default {
  name: 'messageDelete',
  event: 'messageDelete',

  async run({ data: message, client }) {
    console.log(`Message deleted: ${message.content}`);
  },
};
```

---

## Cooldowns

Three scopes available:

```js
cooldown: 10_000,          // 10 seconds
cooldownScope: 'user',     // per user (default)
cooldownScope: 'channel',  // per channel
cooldownScope: 'guild',    // per server
```

---

## Pagination

```js
import { paginate } from 'trexjs';
import { EmbedBuilder } from 'discord.js';

async run({ interaction }) {
  const pages = [
    new EmbedBuilder().setTitle('Page 1').setDescription('First page'),
    new EmbedBuilder().setTitle('Page 2').setDescription('Second page'),
    new EmbedBuilder().setTitle('Page 3').setDescription('Third page'),
  ];
  await paginate({ interaction, pages, timeout: 60_000 });
}
```

---

## Voice audio

```js
import { VoicePlayer } from 'trexjs';

async run({ interaction, client }) {
  const channel = interaction.member.voice.channel;
  const player = new VoicePlayer({ channel, client });
  await player.play('https://example.com/audio.mp3');
  player.on('end', () => player.disconnect());
  await interaction.reply('▶️ Playing!');
}
```

---

## i18n

Create locale files in `locales/`:

```js
// locales/en-US.js
export default {
  'greet.hello': 'Hello, {name}!',
  'errors.guildOnly': 'This command only works in servers.',
};
```

```js
// locales/es-ES.js
export default {
  'greet.hello': '¡Hola, {name}!',
  'errors.guildOnly': 'Este comando solo funciona en servidores.',
};
```

Use in commands via `t()`:

```js
async run({ interaction, t }) {
  const user = interaction.options.getUser('user');
  await interaction.reply(t('greet.hello', { name: user.username }));
}
```

---

## Rule engine (no-code)

The JSON rule engine from v1 is still fully supported — just written in JS:

```js
// Programmatic rules in bot.js
await bot.ruleLoader.saveRule('global', {
  name: 'spam-guard',
  when: 'message',
  if:   { isSpam: true },
  then: [
    { action: 'deleteMessage' },
    { action: 'warnUser', reason: 'Spam detected' },
  ],
});
```

You can also put rules in `src/rules/my-rules.js`:

```js
// src/rules/welcome.js
export default [
  {
    name: 'welcome-member',
    when: 'memberJoin',
    if:   {},
    then: [{ action: 'sendMessage', text: 'Welcome! 🎉' }],
  },
];
```

---

## Plugins

Plugins bundle commands, events, preconditions, and rule-engine extensions together:

```js
// src/plugins/fun.js
import { SlashCommandBuilder } from 'discord.js';

export const funPlugin = {
  name: 'fun',

  commands: [
    {
      data: new SlashCommandBuilder().setName('flip').setDescription('Flip a coin'),
      async run({ interaction }) {
        await interaction.reply(Math.random() > 0.5 ? 'Heads 🪙' : 'Tails 🪙');
      },
    },
  ],

  actions: {
    coinFlip: async (_config, event) => {
      await event.reply(Math.random() > 0.5 ? 'Heads 🪙' : 'Tails 🪙');
    },
  },

  conditions: {
    isWeekend: () => [0, 6].includes(new Date().getDay()),
  },
};
```

```js
// bot.js
import { funPlugin } from './src/plugins/fun.js';
bot.use(funPlugin);
```

---

## Hot reload

Enabled automatically in development (when `hotReload: true`). Just save a file — commands reload and re-sync without restarting.

```js
const bot = createTrex({
  hotReload: process.env.NODE_ENV !== 'production',
});
```

---

## Built-in plugins

| Plugin | Import |
|---|---|
| Moderation (`/warn /kick /ban /purge /timeout`) | `trexjs/plugins/moderation` |
| Voice (`/play /pause /resume /stop`) | `trexjs/plugins/voice` |
