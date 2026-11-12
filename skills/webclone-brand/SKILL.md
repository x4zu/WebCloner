---
name: webclone-brand
description: Extract a measured brand kit and design system from a live website - logo files, semantic color roles, fonts, imagery, voice, layout posture - into brand.json, DESIGN.md, design-dna.json, a Tailwind v4 theme.css, and a brand-kit.html preview. Use when the user wants the colors/fonts/logo/style of a site, a design system from a reference, or tokens to apply to a clone or remix.
argument-hint: "<url>"
---

# /webclone-brand

Turn a live site into a brand kit by **measuring** it. An unmeasured kit regresses to the mean (Inter, indigo accent, purple gradient), which is off-brand for everyone. Every value must trace to something measured.

Target: `$ARGUMENTS`

`<scripts>` means `${CLAUDE_SKILL_DIR}/../webclone/scripts`; references in `${CLAUDE_SKILL_DIR}/../webclone/references/`.

> Method adapted from `brand-extract` in nexu-io/open-design (Apache-2.0); design DNA from zanwei/design-dna (MIT).

## 1. Output folder

- Inside a webclone project: `B = docs/brand/<site>/`.
- Elsewhere: `B = ./<site>-brand/`.

Create `B/logos/`, `B/imagery/`, `B/fonts/`. No URL: ask and stop.

## 2. Measure

```bash
node <scripts>/recon-site.mjs    --url <url> --out B/recon --label original
node <scripts>/asset-harvest.mjs --url <url> --recon B/recon/original-recon.json --out B/assets --manifest B/recon/asset-manifest.json
node <scripts>/motion-probe.mjs  --url <url> --out B/recon/motion --label original
node <scripts>/dna-scaffold.mjs  --recon B/recon/original-recon.json --out B/design-dna.json --name "<brand>"
```

Optionally crawl 3-5 key pages (`route-crawl.mjs --max-pages 5`) so the kit is not built from the home page alone. Look at the screenshots.

Then extract, from the DOM/CSS and recon JSON (not the screenshot alone):

- **Colors**: rank color literals by use (recon `palette`, `rootVariables`, section backgrounds, buttons). Resolve seven roles: `background`, `surface`, `foreground`, `muted`, `border`, `accent`, `accent-secondary`. The most used near-white/near-black surface is usually the background; the most used saturated color on CTAs/links is usually the accent. A role with no measured candidate may be derived from a measured one with `oklch()`; say so in `usage`.
- **Typography**: `@font-face` families and `font-family` values for display, body, mono; weights actually used; sizes of h1/h2/body. Copy font files from `B/assets/fonts/` into `B/fonts/`. For proprietary faces without a file, keep the real family, put the closest Google font first in `fallbacks`, set `googleFontsUrl`, and note "stand-in for <face>".
- **Logo (several candidates)**: write the inline header/nav `<svg>` markup verbatim to `B/logos/header.svg`; also save any `<img>` logo, `apple-touch-icon`, favicon, and `og:image`. Primary = best vector/transparent lockup (SVG wordmark > touch icon > favicon > og:image). Never leave `logo.primary` empty when the site has any mark.
- **Imagery (6-8 images)**: the site's large, representative pictures (og/twitter image, hero art, largest `<img>` at the best `srcset` source, CSS background heroes, product screenshots). Keep only images ~320px+ on the long edge; drop icons, sprites, avatars, logos, pixels. Copy them into `B/imagery/`.
- **Voice**: real headings, taglines, and body lines; derive adjectives, tone, pillars, words used/avoided. Quote, do not paraphrase into marketing speak.
- **Layout posture**: radius, border weight, spacing rhythm, container width, 3-5 posture rules ("hairline borders, no shadows", "full-bleed photography every second section").
- **Motion**: easing curves, durations, smooth-scroll settings from `motion-probe`.

If an anti-bot wall appears ("Just a moment...", "Verify you are human"), stop and ask the user to clear it or to accept a kit from public knowledge, with every such value marked `(from brand knowledge)`. Never bypass the wall.

## 3. Write the kit

`B/brand.json` with this shape (all paths relative to `B`):

```json
{
  "name": "", "tagline": "", "description": "", "sourceUrl": "",
  "logo": { "primary": "logos/header.svg", "alternates": ["logos/apple-touch-icon.png"], "notes": "" },
  "colors": [
    { "role": "background", "hex": "#ffffff", "oklch": "oklch(100% 0 0)", "name": "", "usage": "" }
  ],
  "typography": {
    "display": { "family": "", "fallbacks": [], "weights": [], "notes": "" },
    "body":    { "family": "", "fallbacks": [], "weights": [], "googleFontsUrl": "" },
    "mono":    { "family": "", "fallbacks": [], "weights": [] }
  },
  "voice": { "adjectives": [], "tone": "", "messagingPillars": [], "vocabulary": { "use": [], "avoid": [] } },
  "imagery": { "style": "", "subjects": [], "treatment": "", "avoid": [], "samples": [ { "file": "imagery/hero.jpg", "kind": "hero", "caption": "" } ] },
  "layout": { "radius": "", "borderWeight": "", "spacing": "", "postureRules": [] },
  "motion": { "easing": [], "durations": [], "smoothScroll": "" }
}
```

All seven color roles are required, hex as `#rrggbb`. Do not invent company facts beyond what the copy supports.

Then:

```bash
node <scripts>/brand-kit.mjs --brand B/brand.json     # writes B/brand-kit.html + B/theme.css, validates (exit 2 lists problems)
```

Fix every reported problem and re-run until it prints "brand.json complete".

Complete `B/design-dna.json` ([design-dna.md](../webclone/references/design-dna.md)): fill every field from evidence or `TODO: <missing evidence>`.

Write `B/DESIGN.md`, a prose guide another agent can follow: visual theme, logo usage, color roles with hex and usage, typography scale, voice and tone, imagery, component styling (buttons, inputs, cards, nav), layout and spacing, depth, motion, do's and don'ts.

## 4. Deliver

- Paths to `brand-kit.html` (open it and check it looks like the brand), `brand.json`, `DESIGN.md`, `design-dna.json`, `theme.css`.
- The seven color roles and the fonts, in chat.
- How to apply it: paste `theme.css` into `src/app/globals.css` of a Next.js app, or run `/webclone-remix` with this kit.
- Licensing: logos, fonts, and imagery belong to the brand owner; the kit is reference material unless the user owns the brand.
