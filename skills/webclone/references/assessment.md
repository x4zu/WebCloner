# Complexity grading and clone scoring

Use before building (to set expectations) and after building (to accept or reject the result).

## Clone modes

| Mode | Goal | When |
|---|---|---|
| **Faithful** (default) | Keep the source layout, assets, and interactions as close to 1:1 as possible | "Clone/copy this site". Fidelity is the first goal |
| **Visual** | Looks the same; internals may be rebuilt differently | No usable source, component-based rebuild |
| **Remix** | Keep the rhythm and visual grammar, swap in the user's own content and brand | User says "make it mine", "use my brand" (`/webclone-remix`) |
| **Teardown** | Confirm the real implementation before rebuilding | WebGL/Canvas/complex interaction, conflicting analyses |

Mode discipline: when the user asks to clone a site, the default is **faithful**. Do not silently downgrade to visual mode, placeholder branding, or layout blocks instead of photography because the site is commercial. Clone faithfully first (real images, real fonts, exact colors), record trademark/copyright items in `NOTES.md` under "replace before deploying", and leave replacement to the user. Do not skip scripted recon because a site looks bot-protected: run the scripts first, degrade only if they fail, and record what happened.

## Complexity L1-L6

| Level | Type | Typical signals | Usual fidelity | Default boundary |
|---|---|---|---|---|
| L1 | Static HTML/CSS | Little JS, no framework, few pages | 90-98% | Near pixel-level; asset rights are separate |
| L2 | CMS / corporate content site | Many pages, CMS markup, forms/news/regions | 70-90% | Front end reproducible; CMS back office not cloned |
| L3 | React/Vue/Next content front end | Hydration, chunks, routes, content from APIs | 65-90% | Data/API replaced by local JSON |
| L4 | Animation-heavy brand site | GSAP, Lenis, complex scroll, video masks | 50-80% | Main visuals reproducible; micro-interactions often approximated |
| L5 | WebGL / Canvas / Three.js | Shaders, physics, post-processing, GPU assets | 30-95% | High with source; without it, tear down first |
| L6 | SaaS / e-commerce / logged-in app | Accounts, payment, orders, permissions, search | Presentation layer | Server business logic not cloned |

`compare-recon.mjs` infers a level automatically from recon signals; confirm or override it.

## Pre-clone assessment (write to `docs/research/<site>/NOTES.md`)

```markdown
## Pre-clone assessment
- Complexity level:
- Mode: faithful / visual / remix / teardown
- High-fidelity parts:
- Parts that will be approximated or replaced:
- Not cloned:
- Main risks: license / assets / login / API / performance / WebGL / responsive
```

## Post-clone scoring

Score each dimension 0-5. Give only scores that screenshots, source, or browser runs support.

| Dimension | 5 | 3 | 1 |
|---|---|---|---|
| Source evidence | Source or full static assets found; key conclusions cite file/line | Runtime recon and asset capture | Mostly eyeballed or inferred |
| Structure | Information architecture, section order, breakpoints all match | Main sections match; details merged/cut | Only the general style survives |
| Visual | Fonts, spacing, colors, image ratios very close | Main visuals close; some proportions differ | Clearly a different design |
| Motion/interaction | Scroll, hover, video, Canvas/WebGL behave alike | Core interactions only | Mostly static |
| Responsive | Desktop/tablet/mobile verified, no misalignment | 1-2 widths verified | Mobile clearly broken |
| Functional | Navigation, forms, media, links, local run all work | Main browsing paths work | Dead links or errors |
| Content replacement (remix only) | User's content in place, clear replacement map | Partly replaced, source residue remains | Lots of source copy/brand left |
| Legal/deploy risk | License clear, tracking removed, asset boundaries explicit | Risks recorded, not all resolved | Unclear |

```markdown
## Clone scores
- Source evidence: /5
- Structure: /5
- Visual: /5  (visual-diff score: x/5, diff ratio: y)
- Motion/interaction: /5
- Responsive: /5
- Functional: /5
- Content replacement: /5 or n/a
- Legal/deploy risk: /5
- Overall:
```

## Source vs clone table

```markdown
| Module | Source behavior | Clone implementation | Difference / trade-off | Evidence |
|---|---|---|---|---|
| Hero |  |  |  | screenshot / file:line |
| Navigation |  |  |  |  |
| Key motion |  |  |  |  |
| Content sections |  |  |  |  |
| Mobile |  |  |  |  |
```
