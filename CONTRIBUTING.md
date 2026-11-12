# Contributing

Thanks for helping improve **WebCloner**, the `/webclone` Claude Code plugin.

## What lives where

- `skills/webclone/SKILL.md`: the `/webclone` workflow. This is the single source of truth.
- `skills/webclone/references/`: inspection and Framer/motion guides that the skill loads on demand.
- `skills/webclone/scripts/scaffold.mjs`: creates or reuses the clone project.
- `skills/webclone/scripts/capture.mjs`: Playwright capture fallback.
- `skills/webclone/template/`: the Next.js 16 scaffold that gets copied into each clone.
- `.claude-plugin/`: plugin and marketplace manifests. Bump `version` in `plugin.json` for every release.

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
