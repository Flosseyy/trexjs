# Publishing trexjs to npm

Follow these steps to make `npm install trexjs` work for everyone.

---

## 1. Create an npm account

Go to https://www.npmjs.com and create a free account if you don't have one.

---

## 2. Log in from your terminal

```bash
npm login
```

Enter your username, password, and email when prompted.

---

## 3. Check the package name is available

```bash
npm search trexjs
```

If "trexjs" is taken, edit `package.json` and change `"name"` to something like
`trexjs-bot`, `@yourname/trexjs`, etc.

---

## 4. Make sure your files look right (dry run)

```bash
npm pack --dry-run
```

This shows exactly what files would be published. You should see:
- `src/`
- `cli/`
- `plugins/`
- `template/`
- `README.md`
- `package.json`

You should NOT see: `examples/`, `data/`, `.env`, `logs/`

---

## 5. Publish

```bash
npm publish
```

First time only. After that, bump the version in `package.json` before each update:

```bash
# Patch release (bug fix): 0.1.0 → 0.1.1
npm version patch

# Minor release (new feature): 0.1.0 → 0.2.0
npm version minor

# Then publish:
npm publish
```

---

## 6. Test the install works

In a brand new folder:

```bash
mkdir test-install && cd test-install
npm install -g trexjs
trex init my-bot
cd my-bot
npm run dev
```

---

## What users get after install

```
npm install -g trexjs

trex init my-bot       # scaffolds full project from bundled template
trex add rule          # interactive rule builder
trex list              # lists all rules
trex test              # dry-runs a rule
trex dev               # starts the bot
```

The template/ folder inside the package is copied into their project —
they never need to download a separate file.

---

## Scoped package (optional, if name is taken)

Change `package.json`:
```json
"name": "@yourname/trexjs"
```

Publish:
```bash
npm publish --access public
```

Users install with:
```bash
npm install -g @yourname/trexjs
```
