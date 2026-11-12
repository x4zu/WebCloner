---
name: webclone-audit
description: Score an existing website clone against its source - pixel diff per viewport, route and interaction coverage, motion timing match, and strict fidelity checks for fonts, images, and colors, plus tracking-script and brand-residue scans. Produces CLONE_REPORT.md, CLONE_AUDIT.md, and a ranked fix list. Run inside a /webclone project.
argument-hint: "[source-url] [--fix]"
---

# /webclone-audit

Measure how close the clone is and list what to fix. With `--fix` in the arguments, fix the findings afterwards and re-audit.

Arguments: `$ARGUMENTS`

`<scripts>` means `${CLAUDE_SKILL_DIR}/../webclone/scripts`; references in `${CLAUDE_SKILL_DIR}/../webclone/references/`.

## 1. Context

- Must run in a clone project. Read `.webclone.json` for the sites; a source URL argument narrows to that site. No project found: ask for the project folder and stop.
- `R = docs/research/<site>/`. If `R/recon/original-recon.json` is missing, run source recon first (`recon-site.mjs --url <source> --out R/recon --label original`).
- Start `npm run dev` in the background if nothing is serving the clone; note the port.
- Build the route list: from `R/recon/routes/original-route-map.json` when present, else the URLs in `.webclone.json`.

## 2. Measure every route

For each source route `<path>` with local equivalent `<local>`:

```bash
node <scripts>/recon-site.mjs --url <source><path> --out R/audit/<slug> --label original     # skip when fresh evidence exists
node <scripts>/recon-site.mjs --url http://localhost:<port><local> --out R/audit/<slug> --label clone
node <scripts>/visual-diff.mjs --original R/audit/<slug>/screenshots/original-<w>.png --clone R/audit/<slug>/screenshots/clone-<w>.png \
  --out R/audit/<slug>/visual-diff-<w>.json --diff R/audit/<slug>/screenshots/visual-diff-<w>.png        # w = 1440, 768, 390
```

Site-wide:

```bash
node <scripts>/route-crawl.mjs --url http://localhost:<port>/ --out R/recon/routes-clone --label clone --max-pages 50 --max-depth 3
node <scripts>/interaction-probe.mjs --url http://localhost:<port>/ --out R/recon/interactions-clone --label clone
node <scripts>/motion-probe.mjs --url http://localhost:<port>/ --out R/recon/motion --label clone      # compare with original-motion.json
node <scripts>/compare-recon.mjs --original R/recon/original-recon.json --clone R/audit/<home>/clone-recon.json \
  --visual-diff R/audit/<home>/visual-diff-1440.json \
  --original-routes R/recon/routes/original-route-map.json --clone-routes R/recon/routes-clone/clone-route-map.json \
  --original-interactions R/recon/interactions/original-interactions.json --clone-interactions R/recon/interactions-clone/clone-interactions.json \
  --out CLONE_REPORT.md
node <scripts>/audit-clone.mjs --project . --recon R/recon/original-recon.json --strict --out CLONE_AUDIT.md
npm run check
```

Omit flags whose evidence does not exist. Open the diff images; numbers alone hide where the drift is.

## 3. Report

Add a summary on top of `CLONE_REPORT.md` and in chat:

| Route | 1440 | 768 | 390 | Height drift | Notes |
|---|---|---|---|---|---|
| / | 96.2% (4.5) | ... | ... | 0.4% | hero font fallback |

Then a ranked fix list, largest visible impact first: missing sections or routes, layout geometry and height drift, typography (wrong family/weight/wrapping), asset crops/missing images, colors, spacing, motion timing (easing/duration/ScrollTrigger mismatch), interaction states. Each item names the file to change and the evidence (diff image, recon field, audit line).

Scores per [assessment.md](../webclone/references/assessment.md). Be honest: a white page scores high on pixel ratio, so check height drift and the diff image too.

## 4. --fix

Fix the list top-down, re-running only the affected checks after each batch. Stop when every route is at or above the target the user gave (default: 90% at all three widths, height drift within 3%, `audit-clone --strict` exit 0, `npm run check` green), or when the remaining items need information you cannot get; report those as gaps.
