---
name: webclone-full
description: Clone an entire website - every reachable page, not just one - into a Next.js app (or a 1:1 static mirror for static-built sites), and keep fixing until each route reaches 90-100% measured visual fidelity at desktop, tablet, and mobile. Use when the user wants the whole site cloned with high, verified fidelity.
argument-hint: "<url> [--pages N] [--min 90] [--mirror]"
---

# /webclone-full

Clone the whole site and prove the fidelity per route. Same rules, fidelity gates, and references as `/webclone`; this command adds site-wide coverage and a hard per-route pixel gate.

Arguments: `$ARGUMENTS` (`--pages` default 50, `--min` default 90, `--mirror` forces the static mirror path).

`<scripts>` means `${CLAUDE_SKILL_DIR}/../webclone/scripts`. Read `${CLAUDE_SKILL_DIR}/../webclone/SKILL.md` first and follow it, with the changes below. References: `${CLAUDE_SKILL_DIR}/../webclone/references/`.

This is long work. Keep a checklist of routes in `R/PROGRESS.md` (route, template, status, last fidelity) and update it after every route, so the job survives context compaction or a later session.

## 1. Scope the site

After `/webclone` step 0 (scaffold) and step 1 (source search):

```bash
node <scripts>/route-crawl.mjs --url <url> --out R/recon/routes --label original --max-pages <pages> --max-depth 3
```

Also read `<origin>/sitemap.xml` (and sitemap indexes) and the header/footer navigation. Merge into one route list. Then:

- Drop routes that are out of scope by nature: auth-gated pages, checkout/account, search results with arbitrary queries, external hosts, file downloads. List them in `R/NOTES.md`.
- Group routes by **template** (home, listing, article/detail, product, docs page, legal, contact...). Count pages per template.
- If the site has many pages of one template (blog, docs, products), clone the template once and generate pages from extracted content (`generateStaticParams` + JSON/Markdown in `src/content/`). Extract the real text of every page with a fetch or the browser; never invent articles.
- Tell the user the plan before building: routes in scope, templates, routes excluded, and the expected effort. If it is more than ~30 routes, confirm before starting.

## 2. Pick the engine

Run `recon-site.mjs` on the home page and read the `frameworks` signals.

| Signal | Engine |
|---|---|
| Static-built (Astro, Hugo, Eleventy, Vite SSG, plain HTML) and the user wants maximum fidelity, or `--mirror` | **Mirror**: `mirror-site.mjs` for each route ([static-mirror.md](../webclone/references/static-mirror.md)). Real code + real assets = near 100%. Then self-host fonts, remove tracking, serve. |
| Everything else (React/Next/Vue SPA, Framer, Webflow, WordPress, mixed) | **Rebuild** in Next.js following `/webclone` steps 2-5, template by template. |

A mirror is not editable source; say so. If the user wants to edit the site afterwards, rebuild instead.

## 3. Build template by template

1. Global first: fonts, color tokens, header, footer, navigation (including mobile menu), page-wide motion (Lenis/ScrollTrigger setup), 404 page.
2. For each template: recon one representative page fully (recon, assets, motion, interactions), build it, gate it (step 4), then roll it out to the other pages of that template and gate a sample of them.
3. Rewrite internal links to local routes for every cloned page; leave out-of-scope links pointing to the source and list them.
4. Harvest assets for every page (`asset-harvest.mjs` per route into the same `public/sites/<site>/`); the manifest deduplicates by URL.

## 4. The per-route gate

With `npm run dev` running:

```bash
node <scripts>/fidelity-gate.mjs --origin <origin> --local http://localhost:<port> \
  --route-map R/recon/routes/original-route-map.json --widths 1440,768,390 --min-fidelity <min> --out R/fidelity
```

Use `--only <route>` while iterating on one page. A route passes when, at every width, `fidelityPct >= min`, `meanAbsDiff <= 0.05`, and the page height is within 3%. Open each failing `visual-diff-<width>.png`: pixel ratio is lenient on blank pages, so read the image, not only the number.

Repair loop per failing route, largest impact first: missing sections or wrong page height, layout geometry, fonts and line wrapping, images and crops, colors, spacing, then motion. Re-run the gate for that route after each batch. Dynamic content (dates, rotating testimonials, random order, live counters, video frames, cookie banners) causes unavoidable diff; freeze or hide it consistently on both sides when measuring, or record it as an explained exception.

Stop iterating a route after ~5 rounds without progress and record why (licensed font unavailable, canvas content, A/B variant, geo-specific content).

## 5. Finish

```bash
node <scripts>/audit-clone.mjs --project . --recon R/recon/original-recon.json --strict --out CLONE_AUDIT.md
npm run check
```

Then run `/webclone-audit`'s compare step for route and interaction coverage (`compare-recon.mjs` with both route maps).

Deliver:

- `R/fidelity/FIDELITY.md`: the per-route, per-width table, with N/M routes passing at the chosen minimum.
- Route coverage: cloned / excluded (with reasons) / failing (with reasons).
- `CLONE_AUDIT.md` result and `npm run check` result.
- How to run (`npm run dev`, or `npx serve` for a mirror) and what must be replaced before any public deployment (logos, copy, licensed fonts and media).

Never report a site-wide percentage that hides failing routes; report the worst routes explicitly.
