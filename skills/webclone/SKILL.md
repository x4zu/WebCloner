---
name: webclone
description: Rebuild one or more live web pages as working Next.js 16 + Tailwind v4 + shadcn/ui code that matches their real content, fonts, images, colors, responsive layout, motion, and interactions. Use for website cloning, replication, or reverse engineering, including Framer, GSAP/Lenis, and WebGL sites. Creates the project automatically and gates delivery on measured fidelity.
argument-hint: "<url1> [<url2> ...]"
---

# /webclone

Recreate the supplied pages as an editable Next.js app. Match the source before adding any new design direction. Deliver working code: screenshots, iframes, and copied production bundles are evidence, not the implementation (except the static-mirror path in step 3).

Target URLs: `$ARGUMENTS`

`<scripts>` below means `${CLAUDE_SKILL_DIR}/scripts`. Every script prints usage with `--help`; run that instead of reading its source. References live in `${CLAUDE_SKILL_DIR}/references/`.

Related commands: `/webclone-recon` (inspect only), `/webclone-full` (whole site, 90%+ gate), `/webclone-audit` (score an existing clone), `/webclone-brand` (extract a brand kit), `/webclone-remix` (swap in the user's brand).

## Iron rule: real source beats inference

Every second-hand analysis (blog posts, AI teardowns, your own guesses) is a concept sketch; its code is unverified until checked against real source or measured runtime values. Fonts, colors, timings, and assets come from measurement, never from memory. Record anything estimated as an estimate.

## 0. Set up

1. **URLs.** Take every URL from the arguments or the message; bare domains get `https://`. No URL: ask and stop. Different origins become separate apps unless the user wants one combined app (`--combined`).
2. **Responsible use.** Clone sites the user owns or may reproduce, or for learning/migration. Refuse phishing, impersonation, credential capture, or passing off another brand as the user's. Faithful clones keep the source's logos and copy locally; say that these belong to their owners and must be replaced before any public deployment.
3. **Project.** Needs Node.js 20.9+.
   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs" <url1> [<url2> ...] --install
   ```
   Prints JSON with each `projectDir`. Reuses the current folder when it holds `.webclone.json`; otherwise creates `./<site>-clone/`. Exit 3: target folder is not empty and not a webclone project; ask before `--force` or `--dir`. Exit 4: `npm` install failed; fix it first. Work inside `projectDir` from here; read its `AGENTS.md`.
4. **Browser.** The scripts drive the system Chrome/Edge/Chromium over CDP with zero installs (they also use Playwright when the project has it). If a script reports no compatible browser, ask the user to install Chrome, or set `WEBCLONE_BROWSER_PATH`, or run `npm i -D playwright && npx playwright install chromium` in the project. A browser MCP (Playwright MCP, Chrome DevTools MCP, Claude in Chrome) is a good complement for hover/click/menu states.

Evidence for each site goes to `docs/research/<site>/` (call it `R`); recon output to `R/recon`.

## 1. Look for real source first

Before scraping, spend a minute searching for the actual code: the product name or domain on GitHub (`gh search repos <name>` or web search), `*.vercel.app` / `*.netlify.app` / `*.github.io` slugs (often the repo or user name), and single-file sites via view-source. If found, check its license:

| License | Allowed |
|---|---|
| MIT / Apache / BSD / Unlicense | Modify and deploy; keep attribution |
| None | All rights reserved: local study only, attribute, no public redeploy without permission |
| Proprietary / explicit ban | Read to learn only |

Public on GitHub does not mean MIT. Record source and license in `R/NOTES.md`.

## 2. Recon (measure, do not eyeball)

Run from `projectDir` for each source URL:

```bash
node <scripts>/recon-site.mjs   --url <url> --out R/recon --label original          # screenshots 1440/768/390, palette, fonts, frameworks, motion signals
node <scripts>/asset-harvest.mjs --url <url> --recon R/recon/original-recon.json --out public/sites/<site> --manifest R/recon/asset-manifest.json
node <scripts>/motion-probe.mjs --url <url> --out R/recon/motion --label original   # real easing/duration, GSAP/ScrollTrigger, Lenis
node <scripts>/interaction-probe.mjs --url <url> --out R/recon/interactions --label original
```

Add when relevant:

- Several pages requested or a multi-page site: `route-crawl.mjs --url <url> --out R/recon/routes --label original --max-pages 25 --max-depth 2`.
- SPA/SaaS content from APIs: `network-capture.mjs --url <url> --out R/recon/network --label original` (JSON fixtures).
- WebGL/Canvas or heavy bundles: `sourcemap-hunt.mjs --recon R/recon/original-recon.json --out R/recon/sourcemaps`.

Read `R/recon/original-summary.md` and **look at the screenshots** with the Read tool. A large DOM dump never replaces looking at the page. Then exercise menus, tabs, accordions, carousels, and hover states with a browser tool, and save labeled screenshots of each state.

Read [inspection-guide.md](references/inspection-guide.md) for what to measure. For Framer pages, sticky scenes, or animated media read [framer-and-motion.md](references/framer-and-motion.md); for any motion read [motion.md](references/motion.md).

## 3. Assess and choose the path

Write the pre-clone assessment to `R/NOTES.md` ([assessment.md](references/assessment.md)): complexity L1-L6, mode, what will be exact, what will be approximated, what is out of scope. The default mode for "clone this" is **faithful**.

| Recon result | Path |
|---|---|
| Static/marketing/content site (L1-L3) | Rebuild in Next.js (this skill's default) |
| Multi-page site | Route map first, one template per page type, data-driven pages ([complex-playbooks.md](references/complex-playbooks.md)) |
| SPA/SaaS (L6) | Presentation layer + local JSON fixtures; mock writes |
| Interaction/scroll-heavy (L4) | Rebuild + measured motion ([motion.md](references/motion.md)) |
| WebGL/Canvas/Three.js (L5) | Real source or teardown first ([reverse-engineering.md](references/reverse-engineering.md), [effect-extraction.md](references/effect-extraction.md)), then a client component |
| Custom static-built site (Astro/Vite SSG/Hugo) where 1:1 matters more than editable code | Offer the full asset mirror ([static-mirror.md](references/static-mirror.md)) |

Do not downgrade a faithful clone to placeholder branding because the site is commercial, and do not skip scripted recon because a site looks bot-protected. Run the scripts; degrade only on failure and record it.

## 4. Map the work

Record a source-to-local route map and file ownership in `R/NOTES.md`. Use `src/app/`, `src/components/sites/<site>/`, `public/sites/<site>/`.

- The first root clone replaces the untouched template homepage (`src/app/page.tsx`).
- Preserve source pathnames for several pages of one origin; query/fragment variants are usually states of one route.
- Preserve existing routes/assets; resolve collisions before replacing anything. When adding pages, extend layout and global styles without breaking existing pages.
- A combined multi-origin app needs route prefixes and scoped fonts/styles.
- Escape literal URL segments that clash with framework syntax (`_`, `@`, brackets, parentheses) and verify the real URL.

## 5. Build

Shared foundations first, then sections.

**Fidelity gates (hard requirements, checked by `audit-clone.mjs --strict`):**

1. **Real fonts, self-hosted.** Use the files `asset-harvest` saved. Either link `public/sites/<site>/fonts/fonts.css` from the root layout (keeps the source's exact family names), or copy the files next to a `next/font/local` declaration. Copy `font-family` values from recon `palette.*.fontFamily` / `fontFaces[].family`. A system-font stand-in for a custom font fails the clone. If a font cannot be downloaded or licensed, say so and name the closest stand-in as a gap.
2. **Real images.** Reference files through `asset-manifest.json` (originalUrl -> localPath). No gradients or placeholders in place of photography. Respect `currentSrc`, crop (`object-fit`/`object-position`), and the real format (a `.png` URL may serve AVIF). `next/image` with explicit sizes, or `<img>` when exact rendering matters more.
3. **Exact colors.** Copy computed values from recon `palette` and `rootVariables` into CSS custom properties / Tailwind `@theme`. `rgb(17,17,17)` becomes `#111111`, never "close enough" `#0a0a0a`.
4. **Same scroll feel.** Reproduce smooth-scroll libraries, scroll-snap, sticky elements, and scroll-triggered motion with the values from `motion-probe` (Lenis options, ScrollTrigger start/end/scrub/pin, easing strings, durations).

Then:

- Build each shared component with every observed state (hover, focus, open, breakpoints) so it is reused as-is.
- Use the source's real copy and outbound links. Rewrite links to local routes only when those routes are cloned; disclose out-of-scope links.
- Visible controls must do what they promise (menus open, tabs switch, carousels move, forms validate locally).
- Remove tracking (GA/gtag, pixels, heatmaps) and note it.
- Delegate independent sections or pages to subagents only after shared files have an owner; give each builder screenshots, measurements, asset paths, destination files, and a finish line.
- Run `npm run typecheck` after each integrated slice.

## 6. Compare, repair, gate

Start `npm run dev` in the background (port 3000 unless taken). For each route:

```bash
node <scripts>/recon-site.mjs --url http://localhost:3000/<route> --out R/recon --label clone
node <scripts>/visual-diff.mjs --original R/recon/screenshots/original-1440.png --clone R/recon/screenshots/clone-1440.png \
  --out R/recon/visual-diff-1440.json --diff R/recon/screenshots/visual-diff-1440.png        # repeat for 768 and 390
node <scripts>/motion-probe.mjs --url http://localhost:3000/<route> --out R/recon/motion --label clone   # when the page has motion
node <scripts>/compare-recon.mjs --original R/recon/original-recon.json --clone R/recon/clone-recon.json \
  --visual-diff R/recon/visual-diff-1440.json --out CLONE_REPORT.md
node <scripts>/audit-clone.mjs --project . --recon R/recon/original-recon.json --strict --out CLONE_AUDIT.md
```

Open the diff images. Fix the largest differences first: missing sections/layers, geometry, typography and wrapping, asset crops, then spacing and motion. Re-run the affected checks. Compare animated regions in initial, active, and settled states, including reverse scroll. Exercise navigation, the mobile menu, tabs, carousels, and media with real input; check console errors and horizontal overflow.

**Done means all of:** `audit-clone --strict` exits 0 (or each remaining finding is explained as a deliberate, user-visible gap), `npm run check` passes, and the visual-diff results are reported honestly per width. Never call an unchecked result pixel-perfect.

## Deliver

- Project folder and `cd <projectDir> && npm run dev`.
- Route map (source -> local).
- Per-width fidelity (`fidelityPct`, score) and the diff image paths; `CLONE_REPORT.md`, `CLONE_AUDIT.md`.
- Checks actually run, with results.
- Remaining gaps, approximations, out-of-scope links, and items to replace before deploying (`R/NOTES.md`).

Artifact layout and templates: [deliverables.md](references/deliverables.md).
