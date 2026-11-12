---
name: webclone-remix
description: Turn a cloned website into the user's own - keep its layout, rhythm, and interactions while replacing brand, copy, images, colors, and fonts with the user's (or a fresh, distinctive direction). Applies anti-generic design craft, accessibility, and typography rules, then audits for leftover source branding. Run inside a /webclone project.
argument-hint: "[brief | path to brand.json/DESIGN.md]"
---

# /webclone-remix

Keep the source's information architecture, pacing, and interaction grammar ("the DNA"); replace everything that identifies the source. The result must be deployable as the user's own site.

Brief: `$ARGUMENTS`

`<scripts>` means `${CLAUDE_SKILL_DIR}/../webclone/scripts`. This skill's references: `${CLAUDE_SKILL_DIR}/references/` (craft rules, `frontend-design.md`, starter themes). Shared references: `${CLAUDE_SKILL_DIR}/../webclone/references/`.

## 1. Inputs

- Must run in a clone project (`.webclone.json`). No clone yet: suggest `/webclone <url>` first and stop.
- Brand source, in order of preference:
  1. A `brand.json` / `DESIGN.md` path in the arguments (from `/webclone-brand` on the user's own site, or written by the user).
  2. Brand facts in the brief: name, what they do, audience, colors, fonts, logo file, tone.
  3. Nothing given: ask for the product name, one-line description, audience, and any existing colors/logo. If the user wants you to choose, propose a direction following [frontend-design.md](references/frontend-design.md) (a short token plan: 4-6 named hex colors, type roles, layout notes, principles) and get a yes before building. [themes/](references/themes/README.md) has starter palettes.
- Real content: ask for the user's copy, images, and links, or write honest placeholder copy that says what goes there. Never invent metrics, customer logos, testimonials, awards, or press quotes.

## 2. Capture the DNA

If `docs/research/<site>/design-dna.json` is missing, create it ([design-dna.md](../webclone/references/design-dna.md)):

```bash
node <scripts>/dna-scaffold.mjs --recon docs/research/<site>/recon/original-recon.json --out docs/research/<site>/design-dna.json --name "<site>"
```

Fill `design_style` (composition, rhythm, interaction feel) and `visual_effects` from the clone and its evidence. This is what stays.

## 3. Replacement map

Write `REPLACE_GUIDE.md` before editing: every source-identifying item and its replacement.

| Item | Where (file:line / folder) | Replacement |
|---|---|---|
| Logo, favicon, OG image | `src/components/sites/<site>/...`, `public/...`, `src/app/layout.tsx` metadata | user's files |
| Brand name, product names | grep across `src/` | user's names |
| Copy (headlines, body, CTAs, footer, legal) | components | user's copy |
| Photography, video, illustrations | `public/sites/<site>/` | user's media or honest placeholders |
| Colors | `globals.css` tokens | user's palette |
| Fonts | layout / `fonts.css` | user's fonts (licensed for web) |
| Outbound links, social links, emails | components | user's or removed |
| Metadata, analytics, structured data | `layout.tsx`, `head` | user's |

## 4. Apply

1. **Tokens first.** Apply the brand through CSS custom properties / Tailwind `@theme` (`theme.css` from `/webclone-brand` pastes in directly). Components keep consuming tokens, so the layout survives.
2. **Fonts.** Load with `next/font` (Google) or `next/font/local` (licensed files). Re-check line wrapping: a different face changes widths; adjust sizes/tracking to keep the source's rhythm, not its exact pixel values.
3. **Content and media.** Replace per the map. Keep image aspect ratios and crops so sections keep their proportions.
4. **Rename** `src/components/sites/<site>/` usage only if the user asks; it is internal.
5. Keep interactions and motion from the clone; retune colors in animated states.

Apply these craft rules while editing (read the files you need):

- [anti-ai-slop.md](references/craft/anti-ai-slop.md) - always.
- [color.md](references/craft/color.md), [typography.md](references/craft/typography.md), [typography-hierarchy.md](references/craft/typography-hierarchy.md) - when palette/fonts change.
- [accessibility-baseline.md](references/craft/accessibility-baseline.md) - always: contrast (4.5:1 text, 3:1 large/UI), focus visible, labels, alt text, heading order, reduced motion.
- [state-coverage.md](references/craft/state-coverage.md), [form-validation.md](references/craft/form-validation.md) - forms and stateful UI.
- [laws-of-ux.md](references/craft/laws-of-ux.md) - pricing, onboarding, navigation changes.

## 5. Verify

```bash
node <scripts>/audit-clone.mjs --project . --brand "<source brand>,<source product names>" --out CLONE_AUDIT.md
npm run check
```

- `CLONE_AUDIT.md` must show **no** source brand residue, tracking, or source-domain links (except deliberate ones you list). Here brand residue is a defect.
- Screenshot the remixed pages at 1440/768/390 (`recon-site.mjs --url http://localhost:<port>/ --out docs/research/remix --label remix`) and look at them: layout and rhythm should match the clone; identity should not.
- Check color contrast of the new palette: write the user's palette as a `brand.json` and run `brand-kit.mjs`; `brand-kit.html` shows each color's contrast against background and foreground.

## Deliver

Before/after screenshots, `REPLACE_GUIDE.md` (with anything still pending from the user), audit and check results, and remaining items: media still placeholder, copy to confirm, licenses to verify.
