#!/usr/bin/env node
/**
 * Trex CLI — ships inside the trexjs npm package
 *
 * After: npm install -g trexjs
 * Users can run: trex init, trex add rule, trex list, trex test, trex dev
 *
 * trex init copies the bundled template/ folder into the user's new project.
 * No separate download or file needed.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Template folder lives INSIDE the trexjs package at ../template relative to cli/
const TEMPLATE_DIR = path.join(__dirname, '..', 'template');

const TRIGGERS = ['message', 'memberJoin', 'reaction', 'interaction'];
const CONDITIONS = ['equals', 'contains', 'startsWith', 'hasRole', 'inChannel', 'isSpam', '(none — always run)'];
const ACTIONS = ['reply', 'sendMessage', 'deleteMessage', 'addRole', 'removeRole', 'timeoutUser', 'dmUser', 'warnUser'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRulesPath() {
  return path.join(process.cwd(), 'data', 'global-rules.json');
}

function loadRules() {
  const p = getRulesPath();
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, 'utf-8'));
}

function saveRules(rules) {
  const dir = path.join(process.cwd(), 'data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getRulesPath(), JSON.stringify(rules, null, 2));
}

function banner() {
  console.log(chalk.cyan('\n  🦖 Trex.js — Discord Bot Framework\n'));
}

// ─── trex init ───────────────────────────────────────────────────────────────

async function cmdInit() {
  banner();

  const args = process.argv.slice(3); // trex init [name]
  let botName = args[0];

  if (!botName) {
    const answer = await inquirer.prompt([
      { name: 'botName', message: 'Project name:', default: 'my-trex-bot' },
    ]);
    botName = answer.botName;
  }

  const targetDir = path.join(process.cwd(), botName);

  if (existsSync(targetDir)) {
    console.log(chalk.red(`\n  ❌ Directory "${botName}" already exists.\n`));
    process.exit(1);
  }

  const { token } = await inquirer.prompt([
    {
      name: 'token',
      message: 'Discord bot token (you can set this later in .env):',
      default: '',
    },
  ]);

  console.log(chalk.gray('\n  Scaffolding project...'));

  // Copy the bundled template into the new project folder
  cpSync(TEMPLATE_DIR, targetDir, { recursive: true });

  // Rename .env.example → .env and inject token
  const envSrc = path.join(targetDir, '.env.example');
  const envDest = path.join(targetDir, '.env');
  if (existsSync(envSrc)) {
    const envContent = readFileSync(envSrc, 'utf-8')
      .replace('your_token_here', token || 'your_token_here');
    writeFileSync(envDest, envContent);
    unlinkSync(envSrc);
  }

  // Replace {{BOT_NAME}} in template package.json
  const pkgPath = path.join(targetDir, 'package.json');
  const pkg = readFileSync(pkgPath, 'utf-8').replace('{{BOT_NAME}}', botName);
  writeFileSync(pkgPath, pkg);

  // Install dependencies
  console.log(chalk.gray('  Installing dependencies...\n'));
  try {
    execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
  } catch {
    console.log(chalk.yellow('\n  npm install failed — run it manually inside the project.'));
  }

  console.log(chalk.green(`\n  ✅ Created ${botName}!\n`));
  console.log(chalk.white('  Next steps:\n'));
  console.log(chalk.cyan(`    cd ${botName}`));
  if (!token) console.log(chalk.cyan(`    # edit .env and add your DISCORD_TOKEN`));
  console.log(chalk.cyan(`    npm run dev\n`));
  console.log(chalk.gray('  Add rules:   trex add rule'));
  console.log(chalk.gray('  List rules:  trex list\n'));
}

// ─── trex add rule ───────────────────────────────────────────────────────────

async function cmdAddRule() {
  banner();
  console.log(chalk.white('  Add a new rule\n'));

  const { trigger } = await inquirer.prompt([
    { type: 'list', name: 'trigger', message: 'WHEN (trigger event):', choices: TRIGGERS },
  ]);

  const { conditionType } = await inquirer.prompt([
    { type: 'list', name: 'conditionType', message: 'IF (condition):', choices: CONDITIONS },
  ]);

  let ifBlock = {};
  if (!conditionType.startsWith('(none')) {
    const { conditionValue } = await inquirer.prompt([
      { name: 'conditionValue', message: `Value for "${conditionType}":` },
    ]);
    ifBlock = { [conditionType]: conditionValue };
  }

  const actions = [];
  let addMore = true;

  while (addMore) {
    const { actionType } = await inquirer.prompt([
      { type: 'list', name: 'actionType', message: 'THEN (action):', choices: ACTIONS },
    ]);

    const actionConfig = { action: actionType };

    if (['reply', 'sendMessage', 'dmUser'].includes(actionType)) {
      const { text } = await inquirer.prompt([{ name: 'text', message: 'Response text:' }]);
      actionConfig.text = text;
    } else if (['addRole', 'removeRole'].includes(actionType)) {
      const { role } = await inquirer.prompt([{ name: 'role', message: 'Role name:' }]);
      actionConfig.role = role;
    } else if (actionType === 'timeoutUser') {
      const { duration } = await inquirer.prompt([
        { name: 'duration', message: 'Timeout duration (seconds):', default: '60' },
      ]);
      actionConfig.duration = parseInt(duration) * 1000;
    }

    actions.push(actionConfig);

    const { more } = await inquirer.prompt([
      { type: 'confirm', name: 'more', message: 'Add another action to this rule?', default: false },
    ]);
    addMore = more;
  }

  const { ruleName } = await inquirer.prompt([
    { name: 'ruleName', message: 'Rule name:', default: `${trigger}-rule` },
  ]);

  const rule = { name: ruleName, when: trigger, if: ifBlock, then: actions };
  const rules = loadRules();
  rules.push(rule);
  saveRules(rules);

  console.log(chalk.green('\n  ✅ Rule saved:\n'));
  console.log(chalk.gray(JSON.stringify(rule, null, 2)));
  console.log();
}

// ─── trex list ───────────────────────────────────────────────────────────────

function cmdList() {
  const rules = loadRules();

  if (rules.length === 0) {
    console.log(chalk.yellow('\n  No rules yet. Run: trex add rule\n'));
    return;
  }

  banner();
  console.log(chalk.white(`  ${rules.length} rule(s):\n`));

  rules.forEach((r, i) => {
    const cond = Object.entries(r.if ?? {})
      .map(([k, v]) => `${k}: "${v}"`)
      .join(', ') || 'always';
    const acts = r.then.map(a => a.action).join(', ');

    console.log(`  ${chalk.bold(`${i + 1}. ${r.name ?? r.when}`)}`);
    console.log(chalk.gray(`     WHEN ${r.when}  •  IF ${cond}  •  THEN ${acts}\n`));
  });
}

// ─── trex test ───────────────────────────────────────────────────────────────

async function cmdTest() {
  const rules = loadRules();
  if (rules.length === 0) {
    console.log(chalk.yellow('\n  No rules to test.\n'));
    return;
  }

  banner();

  const { ruleName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'ruleName',
      message: 'Pick a rule to test:',
      choices: rules.map(r => r.name ?? r.when),
    },
  ]);

  const rule = rules.find(r => (r.name ?? r.when) === ruleName);

  const { input } = await inquirer.prompt([
    { name: 'input', message: 'Simulate message content:' },
  ]);

  const ifBlock = rule.if ?? {};
  let matched = true;

  for (const [cond, val] of Object.entries(ifBlock)) {
    const content = input.toLowerCase();
    const v = String(val).toLowerCase();
    if (cond === 'equals')     matched = content === v;
    else if (cond === 'contains')    matched = content.includes(v);
    else if (cond === 'startsWith')  matched = content.startsWith(v);
    else if (cond === 'endsWith')    matched = content.endsWith(v);
    if (!matched) break;
  }

  console.log(chalk.cyan(`\n  Test: "${ruleName}"`));
  console.log(`  Input:  "${input}"`);
  console.log(`  Result: ${matched ? chalk.green('✅ MATCHED') : chalk.red('❌ NO MATCH')}`);
  if (matched) {
    console.log(`  Would run: ${chalk.bold(rule.then.map(a => a.action).join(' → '))}`);
    rule.then.forEach(a => {
      if (a.text) console.log(chalk.gray(`    → "${a.text}"`));
    });
  }
  console.log();
}

// ─── trex remove ─────────────────────────────────────────────────────────────

async function cmdRemove() {
  const rules = loadRules();
  if (rules.length === 0) {
    console.log(chalk.yellow('\n  No rules to remove.\n'));
    return;
  }

  const { ruleName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'ruleName',
      message: 'Which rule to remove?',
      choices: rules.map(r => r.name ?? r.when),
    },
  ]);

  const { confirm } = await inquirer.prompt([
    { type: 'confirm', name: 'confirm', message: `Delete "${ruleName}"?`, default: false },
  ]);

  if (!confirm) { console.log(chalk.gray('  Cancelled.\n')); return; }

  const updated = rules.filter(r => (r.name ?? r.when) !== ruleName);
  saveRules(updated);
  console.log(chalk.green(`\n  ✅ Removed "${ruleName}"\n`));
}

// ─── Router ──────────────────────────────────────────────────────────────────

const [,, command, sub] = process.argv;

switch (command) {
  case 'init':   await cmdInit();    break;
  case 'dev':
    console.log(chalk.cyan('\n  🦖 Starting bot...\n'));
    execSync('node bot.js', { stdio: 'inherit' });
    break;
  case 'add':
    if (sub === 'rule') await cmdAddRule();
    else console.log(chalk.red('  Usage: trex add rule'));
    break;
  case 'list':   cmdList();         break;
  case 'test':   await cmdTest();   break;
  case 'remove': await cmdRemove(); break;
  case 'deploy':
    console.log(chalk.yellow('\n  Deploy support coming in v2. For now: npm run dev\n'));
    break;
  default:
    banner();
    console.log('  Usage:\n');
    console.log(chalk.cyan('    trex init [name]') + chalk.gray('     Scaffold a new bot project'));
    console.log(chalk.cyan('    trex dev') + chalk.gray('             Start bot in dev mode'));
    console.log(chalk.cyan('    trex add rule') + chalk.gray('        Add a rule interactively'));
    console.log(chalk.cyan('    trex list') + chalk.gray('            List all rules'));
    console.log(chalk.cyan('    trex test') + chalk.gray('            Dry-run a rule against input'));
    console.log(chalk.cyan('    trex remove') + chalk.gray('          Remove a rule'));
    console.log();
}
