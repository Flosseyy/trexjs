# 🦖 Trex.js

**Workflow-based Discord bot automation framework.**

Build Discord bots using simple rules — no boilerplate, no wiring.

```
WHEN an event happens → IF conditions match → THEN execute actions
```

---

## Quick Start

```bash
npm install trex.js
npx trex init my-bot
cd my-bot
npx trex dev
```

---

## Rule Format

Rules live in `data/global-rules.json` (or `data/<guildId>-rules.json` for per-server rules):

```json
{
  "name": "hello-rule",
  "when": "message",
  "if": { "equals": "!hello" },
  "then": [{ "action": "reply", "text": "Hello! 👋" }]
}
```

### Built-in Triggers (`when`)
| Trigger | Fires when |
|---------|------------|
| `message` | A message is sent |
| `memberJoin` | A user joins the server |
| `reaction` | A reaction is added |
| `interaction` | A slash command is used |

### Built-in Conditions (`if`)
| Condition | Description |
|-----------|-------------|
| `equals` | Message equals value (case-insensitive) |
| `contains` | Message contains value |
| `startsWith` | Message starts with value |
| `hasRole` | Author has a role |
| `inChannel` | Event from a specific channel |
| `fromUser` | Event from a specific user ID |

### Built-in Actions (`then`)
| Action | Description |
|--------|-------------|
| `reply` | Reply to the message |
| `sendMessage` | Send to channel |
| `deleteMessage` | Delete the triggering message |
| `addRole` | Add a role to the member |
| `removeRole` | Remove a role |
| `timeoutUser` | Timeout the user |
| `dmUser` | Send a DM to the user |

---

## Plugin System

```js
import { createTrex } from 'trex.js';
import { moderationPlugin } from 'trex.js/plugins/moderation';

const trex = createTrex();
trex.use(moderationPlugin);
await trex.start();
```

### Writing a Plugin

```js
export const myPlugin = {
  name: 'my-plugin',
  actions: {
    sendEmbed: async (config, event) => {
      await event.raw.channel.send({ embeds: [{ title: config.title }] });
    },
  },
  conditions: {
    isAdmin: (event) => event.roles?.includes('Admin'),
  },
};
```

---

## CLI

```bash
trex init          # Scaffold a new bot project
trex dev           # Start in dev mode
trex add rule      # Add a rule interactively
trex list          # List all rules
trex test          # Dry-run a rule
trex deploy        # Deploy to production (Level 4)
```

---

## Scaling Roadmap

| Level | Features |
|-------|----------|
| L1 MVP | message rules, reply action |
| L2 | multi-action rules, conditions, CLI |
| L3 | plugins, JSON persistence, logging |
| L4 | dashboard UI, sharding, DB, rate limiting |

---

## Project Structure

```
trex.js/
├── src/
│   ├── index.js              # Public API
│   ├── engine/
│   │   ├── TrexEngine.js     # Core orchestrator
│   │   └── EventNormalizer.js
│   ├── rules/
│   │   ├── RuleLoader.js
│   │   └── ConditionEvaluator.js
│   ├── actions/
│   │   └── ActionExecutor.js
│   ├── plugins/
│   │   └── PluginRegistry.js
│   ├── persistence/
│   │   └── JsonStorage.js    # Swap for MongoStorage
│   └── logger/
│       └── logger.js
├── plugins/
│   └── moderation.js         # Sample plugin
├── cli/
│   └── index.js              # trex CLI
├── examples/
│   └── example-bot.js
├── data/
│   └── global-rules.json
└── package.json
```
