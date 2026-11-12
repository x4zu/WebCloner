<div align="center">

# WebCloner

### `/webclone <url>`: clone any website into a clean Next.js codebase

A Claude Code plugin. Install it once, then run `/webclone` in any folder. It creates the Next.js 16 + Tailwind v4 + shadcn/ui project for you, inspects the live site, and rebuilds it as editable code.

</div>

---

![Source vs clone comparison](docs/assets/comparison.png)

## Install

In Claude Code:

```text
/plugin marketplace add x4zu/WebCloner
/plugin install webclone@webcloner
```

Restart Claude Code (or run `/reload-plugins`) and `/webclone` is available in every project.

Update later with `/plugin marketplace update webcloner`.

## Usage

```text
/webclone https://example.com
/webclone https://example.com https://example.com/pricing
/webclone stripe.com linear.app
```

What happens:

1. **Set up** — creates `./<site>-clone/` (e.g. `example-com-clone/`) from the bundled template and runs `npm ci`. Run `/webclone` inside an existing clone to add pages to it. Different origins get separate apps unless you ask for one combined app.
2. **Map** — maps source URLs to local routes.
3. **Observe** — inspects desktop/mobile layouts, real fonts and assets, and interaction states (scroll, click, hover, time).
4. **Build** — implements editable components with working interactions.
5. **Compare** — screenshots source and clone at matched viewports, fixes the drift, and runs `npm run check`.

You get the project folder, a route map, comparison screenshots, and a list of any remaining gaps.

## Requirements

- [Claude Code](https://code.claude.com/docs)
- [Node.js](https://nodejs.org/) 20.9+ (24 recommended)
- A browser for inspection. Any of these works:
  - a browser MCP you already use (Playwright MCP, Chrome DevTools MCP, Claude in Chrome), or
  - nothing extra: the skill installs Playwright in the clone project and uses its bundled `capture.mjs` script.

## Bundled capture script

`skills/webclone/scripts/capture.mjs` works on its own. Run it from a project that has `playwright` installed:

```bash
node <plugin>/skills/webclone/scripts/capture.mjs https://example.com \
  --out docs/research/example-com/source \
  --assets public/sites/example-com \
  --widths 1440,768,390
```

Output:

- `<width>-top.png` and `<width>-full.png` (taken after wheel-scrolling, so lazy media loads)
- `report.json`: meta, loaded fonts and `@font-face` sources, `:root` CSS variables, heading typography, section boxes, images (`currentSrc`, natural size, `object-fit`), videos, links, detected motion libraries (Lenis, GSAP, Framer, Swiper), horizontal overflow, and network assets
- with `--assets`: downloaded images, fonts, media, and CSS, with their real format detected from the bytes (`asset-map.json` flags a `.png` URL that actually serves AVIF)

## Repository layout

```
.claude-plugin/
  marketplace.json      # marketplace "webcloner"
  plugin.json           # plugin "webclone"
skills/webclone/
  SKILL.md              # the /webclone workflow
  references/           # inspection + Framer/motion guides
  scripts/
    scaffold.mjs        # creates/reuses the clone project
    capture.mjs         # Playwright capture fallback
  template/             # Next.js 16 scaffold copied into each clone
```

## Develop

```bash
git clone https://github.com/x4zu/WebCloner.git
claude --plugin-dir ./WebCloner       # load the plugin from disk without installing

cd WebCloner/skills/webclone/template
npm ci && npm run check               # the scaffold must stay green
```

## Responsible use

For sites you own or may reproduce: platform migrations, recovering lost source code, and learning how production sites are built. Do **not** use it for phishing, impersonation, or passing off someone else's design or brand as your own, and respect each site's terms of service. Logos, brand assets, and copy belong to their owners.

## Credits

Based on [ai-website-cloner-template](https://github.com/JCodesMore/ai-website-cloner-template) by JCodesMore (MIT). The comparison image comes from that project.

## License

[MIT](LICENSE)
