# 1:1 clones of static-built sites: full asset mirror

**For** Astro / Vite SSG / Hugo / Eleventy, and any site whose client runtime ships as downloadable static assets, even WebGL/Canvas/Gaussian-splat-heavy ones.
**Not for** true server-rendered or data-driven SPAs whose data sits behind APIs. Use `network-capture.mjs` and local fixtures instead.

## Why this reaches 1:1

The real source of such sites is not on GitHub, but **the deployed static assets are the truth**: HTML, bundles, CSS, and runtime-fetched binaries (`.sog`, `.buf`, `.wasm`, `.riv`, fonts, images, video). Mirroring them unchanged and serving them from a web root runs the real code with the real assets. It is not a rebuild, so it is byte-for-byte faithful, including the source's quirks.

For static sites, "get the real source" means "mirror the deployed asset set".

Trap: an `astro: true` signal does not mean "find the theme in a theme marketplace". That only holds for sites using an off-the-shelf theme. A custom Astro site has no theme to buy; mirror it.

## Why a real browser scroll, not grep or wget

Binaries like `.buf`, `.sog`, and `.riv` are fetched by JS as scroll progresses, often from URLs built at runtime. Grepping bundles misses them and `wget --mirror` only follows static HTML links. The reliable way is a real browser that loads and scrolls top to bottom, recording every request that actually happens, then mirroring that list.

## Command

```bash
node <scripts>/mirror-site.mjs --url https://<site>/ --out mirror/<site>
```

Output:

- `mirror/<site>/site/...`: mirrored same-origin assets (paths kept; directory URLs saved as `index.html`)
- `own-asset-urls.txt`: same-origin asset list
- `third-party.json`: third-party hosts plus webfont CSS (Typekit/Google) that needs self-hosting
- `mirror-manifest.json`: every request with status

## Manual follow-up for an offline 1:1 run

The script mirrors same-origin assets only and rewrites nothing. Handle third parties from `third-party.json`:

1. **Self-host domain-locked fonts (most often Adobe Typekit).** A kit is locked to its licensed domains, so a remote `@import` may not render on another host.
   - Download the kit CSS with a browser UA and the source as referer: `curl -sL -A "Mozilla/5.0 ... Chrome/..." -e "https://<site>/" "https://use.typekit.net/<kit>.css" -o site/typekit/kit.css`.
   - Extract the `use.typekit.net/af/...` font URLs from its `@font-face` rules and download each into `site/typekit/fonts/`. One face often has three suffixes: `/l` = woff2, `/d` = woff, `/a` = otf. Trust the magic bytes (`wOF2`, `wOFF`, `0x00010000`), not the name.
   - Write local `@font-face` rules with relative URLs and `format()` hints, keeping the original family names and weight ranges.
   - Rewrite the reference. Typekit is often the first line of the main CSS (`@import"https://use.typekit.net/<kit>.css"`), not an HTML `<link>`.
   - Only self-host fonts the user is licensed to use outside the source domain; otherwise note it for replacement.
2. **Remove tracking**: Cloudflare beacon, GA, pixels. Cut the exact `<script>` blocks.
3. **Public CDNs** (Rive wasm on unpkg, third-party players): they load cross-origin while online. Keep them online and note it, or mirror them too and rewrite the injection points for full offline use.
4. **Vimeo/YouTube embeds**: online only. Usually not the hero; note it.

## Serve and verify

```bash
npx serve mirror/<site>/site -l 8124   # serve site/ as the web root so root-relative paths resolve
```

Inside the Next.js clone, the mirror can also live under `public/` when its root-relative paths do not collide with app routes; otherwise keep it as a separate static root. Then follow the compare step: zero console errors and `visual-diff.mjs` against the source. For WebGL-heavy sites, screenshot each scroll section; a static full-page capture misses scroll-triggered GL frames.

## Worked example (from the original skill)

A Lusion-built Gaussian-splat site (L6): 135 same-origin assets (HTML, bundles, CSS, 25 `.buf` geometry/camera files, 2 `.sog` splats, sorting wasm, `.riv`, MSDF, fonts, 80+ images). Only rewrites: Typekit `@import` to a self-hosted copy, and removal of the Cloudflare beacon. Result: identical `scrollHeight`, zero console errors, hero pixel diff 36 of 1.3M pixels (5/5). Vimeo gallery video and the unpkg Rive wasm stayed online.
