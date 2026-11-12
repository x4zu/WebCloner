---
name: webclone
description: Rebuild one or more live websites as working Next.js 16 + Tailwind v4 + shadcn/ui pages that match their real content, assets, responsive layout, and interactions. Use for website cloning, replication, or reverse engineering, including Framer sites and animated pages. Creates the Next.js project automatically; no template repository needed.
argument-hint: "<url1> [<url2> ...]"
---

# /webclone

Recreate the supplied pages as an editable Next.js app. Match the source before adding a new design direction. Deliver working, editable code: screenshots, iframes, and downloaded production bundles are references, not the implementation.

Target URLs: `$ARGUMENTS`

Skill files live in `${CLAUDE_SKILL_DIR}`: `scripts/scaffold.mjs`, `scripts/capture.mjs`, `references/`, and the Next.js scaffold in `template/`.

## 0. Set up

**URLs.** Take every URL from the arguments (or the user's message). Bare domains get `https://`. No URL given: ask for one and stop. Different origins become separate apps unless the user asked for one combined app (pass `--combined`).

**Responsible use.** Clone sites the user owns or has permission to reproduce, or for learning/migration. Refuse phishing, impersonation, credential capture, or passing off someone else's brand as their own. Keep logos and copy as-is only for faithful local reproduction, and remind the user that brand assets belong to their owners.

**Project.** Requires Node.js 20.9+ (`node -v`). Run:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs" <url1> [<url2> ...] --install
```

It prints JSON with each `projectDir`. Behavior:

- Current directory already a webclone project (`.webclone.json`): reused, new sites are added to it.
- Otherwise: new `./<site>-clone/` per origin (e.g. `stripe-com-clone/`), template copied, `npm ci` run.
- Exit code 3: target folder exists, is not empty, and is not a webclone project. Ask the user before rerunning with `--force` or `--dir <other>`.
- Exit code 4: dependency install failed. Show the npm error and fix it before building.

Work inside `projectDir` from here on. Its `AGENTS.md` holds the project conventions; read it. Per site it created `src/components/sites/<site>/`, `public/sites/<site>/`, and `docs/research/<site>/`.

**Browser.** Steps 2 and 4 need a real browser. Use the first available:

1. A browser MCP/tool already in the session (Playwright MCP `browser_*`, Chrome DevTools MCP, Claude in Chrome). Prefer it for interaction: hover, click, menus, scroll scenes.
2. Otherwise the bundled Playwright capture. In `projectDir`, once:
   ```bash
   npm install --save-dev playwright && npx playwright install chromium
   ```
   Then per source page:
   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/capture.mjs" <url> --out docs/research/<site>/source --assets public/sites/<site> --widths 1440,768,390
   ```
   It saves top and full-page screenshots per width (after wheel-scrolling to load lazy media), `report.json` (meta, fonts and `@font-face` sources, `:root` CSS variables, heading typography, section boxes, images with `currentSrc`/natural size/`object-fit`, videos, links, motion libraries, horizontal overflow, network assets), and downloads loaded assets with their **real** format sniffed into `asset-map.json`. View the screenshots with the Read tool. For states the script cannot reach (hover, open menus, tabs), write a short Playwright script in `scripts/` using the same project install.
3. Neither works: tell the user a browser tool is needed for fidelity, and continue with HTTP extraction only if they agree.

## 1. Map the work

Read the project's `AGENTS.md`, `package.json` scripts, and existing routes. Open the source URLs. Prefer direct HTTP, asset tools, or APIs for extraction when practical; use the browser to establish appearance and behavior.

Record a short source-to-local route map and the files each page owns in `docs/research/<site>/brief.md`. Use `src/app/`, `src/components/sites/<site>/`, `public/sites/<site>/`, and `docs/research/<site>/`. Give origins, pages, and downloads distinct names; add a port or URL hash when readable names collide.

- A first root clone replaces the untouched template homepage (`src/app/page.tsx`).
- Preserve source pathnames for multiple pages from one origin. Query/fragment variations usually represent states of the same route; reproduce those states.
- Preserve existing authored routes/assets. Update them when requested; resolve unrequested route collisions before replacing anything.
- When adding pages to an existing clone, extend its layout and global styles without replacing the styles used by existing pages.
- A combined app for several origins needs distinct route prefixes and scoped fonts, styles, and layout.
- Escape literal URL segments that conflict with framework syntax (`_`, `@`, brackets, parentheses) using its supported mechanism, then verify the actual requested URL.

Existing clones are useful starting points: compare them with the current source and record what was reused. Finish when every requested URL has a destination and file ownership is clear.

## 2. Observe before building

Inspect the whole page at desktop and mobile widths. Scroll top to bottom to load lazy media and reveal sticky/pinned scenes. Then exercise menus, tabs, accordions, carousels, hover states, and primary links. Distinguish changes driven by **scroll, click, hover, or time**; a click imitation of a scroll-driven section is a different product.

Treat each observation as one sample of a **rule**. Read declared values (computed styles, CSS variables, a library's live options) rather than inferring them from one rendering, and vary viewport width (including wider than the design), viewport height, input, and state until you know what drives each change. Drive the page with the inputs visitors use (wheel, touch, keyboard, pointer); scripted scrolling bypasses behavior attached to them, such as smooth scrolling.

Save source screenshots labeled with viewport, scroll position, and interaction state in `docs/research/<site>/`. Capture alternate-state content/assets. Keep one compact page brief: section order, typography, layout measurements, asset mapping, and interactions. Add section briefs only when they help independent builders.

Read [the inspection reference](references/inspection-guide.md) for extraction and state comparison. For **Framer-generated pages, sticky scenes, reveal animations, or animated media**, read [Framer and motion](references/framer-and-motion.md).

Use the source's real text and the files it actually loads: fonts, images, SVGs, and video. A same-named substitute from another provider or icon set has different metrics or shapes. Measure important geometry/computed styles. Inspect layered images and media elements before rebuilding a visual as HTML. Track source URL → local asset path and verify content type/dimensions: a `.png` URL may return AVIF (`asset-map.json` flags this as `formatMismatch`).

Finish when every section and meaningful state has enough evidence to build, with unavailable details identified. A large DOM dump does not replace looking at the page.

## 3. Build a complete first pass

Establish fonts (`next/font/local` for downloaded files), page width, colors, assets, routes, page-wide behavior, and shared components first. Build each shared component with every observed state (hover, focus, breakpoints) so builders reuse it as-is. Reuse fitting components. Prefer CSS for layout/simple motion and an animation library when source behavior needs it.

Build coherent sections with real content. Delegate independent pages/sections after shared files have an owner. Give builders screenshots, relevant measurements/state notes, asset paths, destination files, and a concrete finish line. A concise brief with precise file references is enough; no fixed agent count or per-component paperwork is required.

Recreate in-scope interactions. Preserve real outbound destinations. Rewrite links to local routes when those routes are included; leave out-of-scope destinations pointing to the source and disclose them. Visible controls must perform the behavior they promise.

Run `npm run typecheck` after an integrated slice. Finish this pass when every requested section/route renders with actual assets and important controls work.

## 4. Compare, repair, repeat

Start `npm run dev` in the background. Open source/local pages at the **same viewport, scroll position, and state**. With the bundled capture, run it against the local route into a sibling folder and compare pairs:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/capture.mjs" http://localhost:3000/<route> --out docs/research/<site>/local --widths 1440,768,390
```

Let fonts, media, and reveal animations settle. Review the whole page wherever step 2 found a rule changing, plus a viewport wider than the design; judge scroll and pointer behavior with real input. A side-by-side montage locates drift; full-size sections establish detail.

Fix the largest visible differences first: geometry, missing sections/layers, typography/wrapping, asset crop, then spacing and motion. Recheck affected views. Compare animated regions in initial, active, and settled states, including reverse scroll when relevant.

Exercise the real local workflow: navigation between cloned routes, mobile menu, tab/accordion states, carousel boundaries, primary actions, media controls, and observed scroll-linked transitions. Check runtime errors, missing assets, and horizontal overflow (`report.json` → `horizontalOverflow`). When adding pages, verify existing routes still work. Use a few browser checks at these boundaries rather than assertions about class names.

Run `npm run check` (lint + typecheck + build). Completion requires a successful build **and** rendered comparison. State remaining differences precisely instead of calling an unchecked result pixel-perfect.

## Deliver

Return:

- Project folder and run instructions (`cd <projectDir> && npm run dev`).
- Source-to-local route map.
- Representative desktop/mobile comparison screenshot paths.
- Checks actually run, with results.
- Remaining visual/functional gaps and out-of-scope links.
