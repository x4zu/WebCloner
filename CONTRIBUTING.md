# Contributing

Thanks for helping improve **WebCloner**, the `/webclone` Claude Code plugin.

## What lives where

- `skills/webclone/SKILL.md`: the main `/webclone` workflow. Other commands live in `skills/webclone-*/SKILL.md` and call the shared scripts.
- `skills/webclone/references/`: guides the skills load on demand.
- `skills/webclone/scripts/`: all scripts (see README). Each must keep working with `--help` and without Playwright installed.
- `skills/webclone/template/`: the Next.js 16 scaffold copied into each clone.
- `skills/webclone-remix/references/`: craft rules, frontend-design, themes.
- `.claude-plugin/`: plugin and marketplace manifests. Bump `version` in both for every release.
- `THIRD_PARTY_NOTICES.md` + `LICENSES/`: update them whenever you bring in outside material.

## Develop

```bash
git clone https://github.com/x4zu/WebCloner.git
cd WebCloner
claude --plugin-dir .                 # load the plugin from disk
claude plugin validate .              # check the manifests

cd skills/webclone/template
npm ci && npm run check               # the scaffold must stay green
```

Run a scaffold smoke test before opening a PR:

```bash
mkdir -p /tmp/wc && cd /tmp/wc
node <repo>/skills/webclone/scripts/scaffold.mjs example.com --install
cd example-com-clone && npm run check
```

## Pull requests

1. Branch off `main`.
2. Keep each PR focused on one change.
3. Run the checks above.
4. Add a line to `CHANGELOG.md`.
