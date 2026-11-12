---
name: webclone-recon
description: Inspect a live website without building anything - screenshots at desktop/tablet/mobile, real fonts/images/colors, route map, interactions, motion timings, API calls, and a complexity grade (L1-L6) with a recommended clone mode. Use before cloning, to estimate effort, or to gather design evidence from a site.
argument-hint: "<url> [--pages N]"
---

# /webclone-recon

Measure a site and report what a clone would take. Build nothing.

Target: `$ARGUMENTS`

`<scripts>` means `${CLAUDE_SKILL_DIR}/../webclone/scripts`; references are in `${CLAUDE_SKILL_DIR}/../webclone/references/`. Scripts print usage with `--help`.

## 1. Where to write

- Inside a webclone project (`.webclone.json` present): `R = docs/research/<site>/`, assets to `public/sites/<site>/`.
- Anywhere else: `R = ./<site>-recon/`, assets to `R/assets/`. `<site>` is the host without `www.`, dots replaced by `-` (e.g. `stripe-com`).

No URL: ask and stop. Same responsible-use limits as `/webclone`.

Scripts use the system Chrome/Edge over CDP. If none is found, ask the user to install Chrome or set `WEBCLONE_BROWSER_PATH`.

## 2. Run

```bash
node <scripts>/recon-site.mjs        --url <url> --out R/recon --label original
node <scripts>/asset-harvest.mjs     --url <url> --recon R/recon/original-recon.json --out <assets> --manifest R/recon/asset-manifest.json
node <scripts>/motion-probe.mjs      --url <url> --out R/recon/motion --label original
node <scripts>/interaction-probe.mjs --url <url> --out R/recon/interactions --label original
node <scripts>/route-crawl.mjs       --url <url> --out R/recon/routes --label original --max-pages <N, default 25> --max-depth 2
node <scripts>/network-capture.mjs   --url <url> --out R/recon/network --label original
node <scripts>/sourcemap-hunt.mjs    --recon R/recon/original-recon.json --out R/recon/sourcemaps
```

Also check `<origin>/sitemap.xml` and `<origin>/robots.txt` with a plain fetch, and search GitHub/web for the site's real source (see `/webclone` step 1 for the license table).

Look at every screenshot with the Read tool before writing conclusions.

## 3. Report

Write `R/RECON.md` and summarize it in chat:

```markdown
# Recon: <url>
## Snapshot
- Title / language / framework signals (Next, Nuxt, Framer, Webflow, Astro, GSAP, Lenis, Three...)
- Pages found: N (route map: R/recon/routes/original-route-map.md)
- Page height at 1440 / 768 / 390
## Design evidence
- Fonts: families, weights, files downloaded (self-hostable? license notes)
- Palette: body/header/nav/main/footer/buttons computed colors; key :root variables
- Images/video: count downloaded, format mismatches, failures
- Motion: smooth scroll (Lenis options), ScrollTriggers (start/end/pin/scrub), main easings/durations
- Interactions: menus, tabs, carousels, hover effects found
- APIs: content endpoints and fixtures saved
## Assessment (references/assessment.md)
- Complexity: L?  · Recommended mode: faithful / visual / remix / teardown
- Exact / approximated / out of scope
- Real source found? license?
- Risks: login, anti-bot, licensed fonts, WebGL, API dependence
## Suggested next command
- /webclone <urls...>   or   /webclone-full <url>   or   /webclone-brand <url>
```

State plainly what could not be measured (blocked pages, cross-origin stylesheets, canvas content) instead of filling gaps from memory. If an anti-bot wall blocks the page, stop and tell the user; never try to bypass it.
