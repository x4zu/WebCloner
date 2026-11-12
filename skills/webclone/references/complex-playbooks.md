# Playbooks for complex sites (L4-L6)

Turn "looks complicated" into an executable path. Script paths are relative to `skills/webclone/scripts/`.

## L4 animation-heavy brand site

1. `recon-site.mjs`: three-width screenshots, sections, video/canvas counts.
2. Record scroll-library signals: GSAP / Lenis / ScrollTrigger / Locomotive (recon `frameworks` + `motion`).
3. Split the page into hero, scroll narrative, video masks, hover, and transitions.
4. Reproduce rhythm and visual grammar first. Micro-interactions may be approximated, but mark every difference in `CLONE_REPORT.md`.
5. Score the hero and key scroll positions with `visual-diff.mjs`.
6. Read [motion.md](motion.md) for measuring and implementing the motion.

## L5 WebGL / Canvas / Three.js

1. Find real source first: source maps, public repos. Reverse the bundle only if nothing exists.
2. `recon-site.mjs` records canvas size/count and framework signals.
3. `sourcemap-hunt.mjs` tries to download source maps.
4. Split into technical pillars: rendering, shaders, post-processing, physics, interaction, audio, asset loading.
5. Never write a complex shader blind. Build a minimal running scene from the real draw calls first, then add material, lighting, and post-processing one at a time. See [effect-extraction.md](effect-extraction.md) and [reverse-engineering.md](reverse-engineering.md).
6. Verify interaction with real browser input or screenshot/video evidence, never by reading code alone.
7. A static-built WebGL site (Astro/Vite SSG) is often best cloned by mirroring its deployed assets: [static-mirror.md](static-mirror.md).

## L6 SaaS / e-commerce / logged-in app

Clone only the presentation layer and demo flows. No real accounts, payment, orders, or permissions.

1. For logged-in pages, confirm authorization and privacy boundaries first.
2. `network-capture.mjs` saves XHR/fetch responses as fixtures.
3. Classify endpoints: content, search/filter, user state, transactions/writes.
4. Content endpoints become local JSON (`src/data/` or route handlers). Transaction/write endpoints only mock success/failure states.
5. Keep empty, loading, error, and permission-denied states, not only the happy path.
6. `audit-clone.mjs` scans external links, source-brand residue, and tracking scripts.

## Multi-page / CMS / corporate site

1. Capture sitemap, navigation, footer, and main templates (`route-crawl.mjs`).
2. Group routes by template: home, list, detail, search/filter, contact.
3. Generate repeated pages from data files (`generateStaticParams` + JSON/Markdown), never hand-write each page.
4. The CMS back office is not cloned. If editing is needed, use local JSON/Markdown.

## Success criteria

- Complete source evidence: screenshots, recon JSON, network list, asset manifest.
- Clone runs locally; console/page errors are zero or explained.
- `CLONE_REPORT.md` scores structure, visual, interaction, responsive, and functional boundaries.
- `CLONE_AUDIT.md` has no fidelity defects, tracking scripts, or unexplained external-link risks.
- Anything impossible (real back end, proprietary APIs, licensed media) is stated as a boundary.
