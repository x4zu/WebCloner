#!/usr/bin/env node
// Playwright fallback for /webclone when no browser tool (Playwright MCP, Chrome DevTools MCP,
// Claude in Chrome) is available. Also useful for repeatable source-vs-local comparisons.
//
// Usage (run from the clone project, where `playwright` is installed as a devDependency):
//   node capture.mjs <url> --out <dir> [--widths 1440,390] [--height 900] [--assets <dir>]
//                    [--no-full] [--no-scroll] [--timeout 60000]
//
// Writes into --out:
//   <width>-top.png        viewport screenshot at the top of the page
//   <width>-full.png       full-page screenshot after scrolling (lazy media loaded)
//   report.json            page facts: meta, fonts, CSS variables, typography, sections,
//                          images, videos, links, motion libraries, overflow, network assets
// With --assets <dir>: saves images, fonts, media, and stylesheets the page loaded, sniffs
// their real format (a .png URL may return AVIF), and writes <dir>/asset-map.json.

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

function fail(message, code = 1) {
  process.stderr.write(`webclone capture: ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { url: null, out: null, widths: [1440, 390], height: 900, assets: null, full: true, scroll: true, timeout: 60000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => argv[++i] ?? fail(`${arg} needs a value`);
    if (arg === "--out") opts.out = path.resolve(value());
    else if (arg === "--widths") opts.widths = value().split(",").map((w) => Number.parseInt(w, 10)).filter(Boolean);
    else if (arg === "--height") opts.height = Number.parseInt(value(), 10);
    else if (arg === "--assets") opts.assets = path.resolve(value());
    else if (arg === "--timeout") opts.timeout = Number.parseInt(value(), 10);
    else if (arg === "--no-full") opts.full = false;
    else if (arg === "--no-scroll") opts.scroll = false;
    else if (arg.startsWith("--")) fail(`unknown option ${arg}`);
    else opts.url = arg;
  }
  if (!opts.url || !opts.out) fail("usage: node capture.mjs <url> --out <dir> [--widths 1440,390] [--assets <dir>]", 2);
  return opts;
}

// Resolve playwright from the current project, not from this script's directory.
function loadPlaywright() {
  const require = createRequire(path.join(process.cwd(), "package.json"));
  try {
    return require("playwright");
  } catch {
    fail(
      "playwright is not installed in this project. Run:\n" +
        "  npm install --save-dev playwright && npx playwright install chromium\n" +
        "then rerun this command from the project directory.",
      2,
    );
  }
}

const SIGNATURES = [
  { ext: "png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "gif", test: (b) => b.toString("ascii", 0, 3) === "GIF" },
  { ext: "webp", test: (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
  { ext: "avif", test: (b) => b.toString("ascii", 4, 8) === "ftyp" && /avi[fs]/.test(b.toString("ascii", 8, 12)) },
  { ext: "mp4", test: (b) => b.toString("ascii", 4, 8) === "ftyp" },
  { ext: "webm", test: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  { ext: "woff2", test: (b) => b.toString("ascii", 0, 4) === "wOF2" },
  { ext: "woff", test: (b) => b.toString("ascii", 0, 4) === "wOFF" },
  { ext: "ttf", test: (b) => b[0] === 0x00 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00 },
  { ext: "otf", test: (b) => b.toString("ascii", 0, 4) === "OTTO" },
  { ext: "ico", test: (b) => b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00 },
  { ext: "svg", test: (b) => /<svg[\s>]/i.test(b.toString("utf8", 0, 512)) },
];

const TYPE_EXT = {
  "text/css": "css",
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "font/woff2": "woff2",
  "font/woff": "woff",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

function sniffExt(buffer, contentType) {
  const hit = SIGNATURES.find((sig) => buffer.length >= 12 && sig.test(buffer));
  if (hit) return hit.ext;
  return TYPE_EXT[(contentType ?? "").split(";")[0].trim()] ?? "bin";
}

function safeName(url, ext, used) {
  const parsed = new URL(url);
  const base = path.basename(parsed.pathname).replace(/\.[a-z0-9]+$/i, "") || "index";
  let name = `${base.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60) || "asset"}.${ext}`;
  for (let n = 2; used.has(name); n++) name = name.replace(/(-\d+)?\.([a-z0-9]+)$/i, `-${n}.$2`);
  used.add(name);
  return name;
}

async function humanScroll(page) {
  // Wheel input (not window.scrollTo) so smooth-scroll and scroll-linked handlers run.
  let last = -1;
  for (let i = 0; i < 400; i++) {
    const { y, max } = await page.evaluate(() => ({ y: window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight }));
    if (y >= max - 2 || (y === last && i > 3)) break;
    last = y;
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
}

function inspectPage() {
  const px = (n) => Math.round(n);
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: px(r.x), y: px(r.y + window.scrollY), w: px(r.width), h: px(r.height) };
  };
  const type = (el) => {
    const cs = getComputedStyle(el);
    return {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      color: cs.color,
      textTransform: cs.textTransform,
    };
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };

  const cssVars = {};
  const fontFaces = [];
  const sheets = [];
  for (const sheet of document.styleSheets) {
    sheets.push(sheet.href ?? "inline");
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin stylesheet
    }
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule) {
        fontFaces.push({
          family: rule.style.getPropertyValue("font-family"),
          weight: rule.style.getPropertyValue("font-weight"),
          style: rule.style.getPropertyValue("font-style"),
          src: rule.style.getPropertyValue("src"),
        });
      } else if (rule instanceof CSSStyleRule && /(^|,)\s*(:root|html)\s*(,|$)/.test(rule.selectorText)) {
        for (const prop of rule.style) if (prop.startsWith("--")) cssVars[prop] = rule.style.getPropertyValue(prop).trim();
      }
    }
  }

  const loadedFonts = [];
  if (document.fonts) {
    for (const face of document.fonts) {
      if (face.status === "loaded") loadedFonts.push({ family: face.family, weight: face.weight, style: face.style });
    }
  }

  const root = document.querySelector("main") ?? document.body;
  const sectionNodes = [...root.children].filter(visible);
  const sections = sectionNodes.slice(0, 60).map((el) => {
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      className: typeof el.className === "string" ? el.className.slice(0, 120) : undefined,
      framerName: el.getAttribute("data-framer-name") ?? undefined,
      rect: rect(el),
      background: cs.backgroundColor,
      backgroundImage: cs.backgroundImage !== "none" ? cs.backgroundImage.slice(0, 200) : undefined,
      position: cs.position !== "static" ? cs.position : undefined,
      text: (el.innerText ?? "").trim().replace(/\s+/g, " ").slice(0, 160),
    };
  });

  const headings = [...document.querySelectorAll("h1,h2,h3,h4")].filter(visible).slice(0, 40).map((el) => ({
    tag: el.tagName.toLowerCase(),
    text: el.innerText.trim().replace(/\s+/g, " ").slice(0, 140),
    rect: rect(el),
    ...type(el),
  }));

  const images = [...document.images].slice(0, 200).map((img) => ({
    src: img.currentSrc || img.src,
    srcset: img.srcset || undefined,
    alt: img.alt,
    natural: [img.naturalWidth, img.naturalHeight],
    rect: rect(img),
    objectFit: getComputedStyle(img).objectFit,
    objectPosition: getComputedStyle(img).objectPosition,
    loading: img.loading || undefined,
  }));

  const videos = [...document.querySelectorAll("video")].map((v) => ({
    src: v.currentSrc || v.src || v.querySelector("source")?.src,
    poster: v.poster || undefined,
    autoplay: v.autoplay,
    loop: v.loop,
    muted: v.muted,
    controls: v.controls,
    rect: rect(v),
  }));

  const links = [...document.querySelectorAll("a[href]")].slice(0, 300).map((a) => ({
    text: (a.innerText || a.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 80),
    href: a.href,
    inNav: Boolean(a.closest("nav,header")),
  }));

  const scripts = [...document.scripts].map((s) => s.src).filter(Boolean);
  const html = document.documentElement;
  const motion = {
    lenis: html.classList.contains("lenis") || "lenis" in window,
    gsap: "gsap" in window || scripts.some((s) => /gsap/i.test(s)),
    framer: Boolean(document.querySelector("[data-framer-name],[data-framer-component-type]")),
    framerMotion: scripts.some((s) => /framer-motion|motion/i.test(s)),
    swiper: Boolean(document.querySelector(".swiper")) || "Swiper" in window,
    webflow: Boolean(html.getAttribute("data-wf-site")),
  };

  const meta = {};
  for (const m of document.querySelectorAll("meta[name],meta[property]")) {
    const key = m.getAttribute("name") ?? m.getAttribute("property");
    if (/^(description|theme-color|viewport|og:|twitter:)/.test(key)) meta[key] = m.getAttribute("content");
  }
  const icons = [...document.querySelectorAll("link[rel*=icon]")].map((l) => ({ rel: l.rel, href: l.href, sizes: l.sizes?.value || undefined }));

  return {
    title: document.title,
    lang: html.lang,
    meta,
    icons,
    viewport: [window.innerWidth, window.innerHeight],
    scrollHeight: html.scrollHeight,
    horizontalOverflow: html.scrollWidth > window.innerWidth,
    body: { ...type(document.body), background: getComputedStyle(document.body).backgroundColor },
    cssVars,
    fontFaces,
    loadedFonts,
    stylesheets: sheets,
    motion,
    sections,
    headings,
    images,
    videos,
    inlineSvgCount: document.querySelectorAll("svg").length,
    links,
    scripts,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { chromium } = loadPlaywright();
  fs.mkdirSync(opts.out, { recursive: true });

  let browser;
  try {
    browser = await chromium.launch();
  } catch (error) {
    fail(`could not launch Chromium (${error.message.split("\n")[0]}). Run: npx playwright install chromium`, 2);
  }

  const network = new Map();
  const report = { url: opts.url, capturedAt: new Date().toISOString(), viewports: {} };

  for (const width of opts.widths) {
    const mobile = width <= 480;
    const context = await browser.newContext({
      viewport: { width, height: mobile ? Math.max(780, Math.round(opts.height * 0.95)) : opts.height },
      isMobile: mobile,
      hasTouch: mobile,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on("response", async (res) => {
      const kind = res.request().resourceType();
      if (!["image", "font", "media", "stylesheet"].includes(kind) || network.has(res.url())) return;
      if (res.url().startsWith("data:")) return;
      const entry = { url: res.url(), status: res.status(), kind, contentType: res.headers()["content-type"] };
      network.set(res.url(), entry);
      if (opts.assets && res.ok() && kind !== "media") {
        try {
          entry.body = await res.body();
        } catch {
          // body unavailable (redirect or evicted); keep the URL for a direct download
        }
      }
    });

    try {
      await page.goto(opts.url, { waitUntil: "networkidle", timeout: opts.timeout });
    } catch {
      await page.goto(opts.url, { waitUntil: "load", timeout: opts.timeout });
    }
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(1200);

    await page.screenshot({ path: path.join(opts.out, `${width}-top.png`) });
    if (opts.scroll) await humanScroll(page);
    if (opts.full) await page.screenshot({ path: path.join(opts.out, `${width}-full.png`), fullPage: true });

    report.viewports[width] = await page.evaluate(inspectPage);
    await context.close();
  }
  await browser.close();

  const assets = [];
  if (opts.assets) {
    fs.mkdirSync(opts.assets, { recursive: true });
    const used = new Set();
    for (const entry of network.values()) {
      let body = entry.body;
      if (!body && entry.status < 400) {
        try {
          const res = await fetch(entry.url);
          if (res.ok) body = Buffer.from(await res.arrayBuffer());
        } catch {
          // leave unresolved
        }
      }
      if (!body) {
        assets.push({ url: entry.url, kind: entry.kind, status: entry.status, localPath: null, note: "not downloaded" });
        continue;
      }
      const ext = sniffExt(body, entry.contentType);
      const name = safeName(entry.url, ext, used);
      fs.writeFileSync(path.join(opts.assets, name), body);
      const urlExt = path.extname(new URL(entry.url).pathname).slice(1).toLowerCase();
      assets.push({
        url: entry.url,
        kind: entry.kind,
        contentType: entry.contentType,
        bytes: body.length,
        localPath: path.relative(process.cwd(), path.join(opts.assets, name)).replaceAll("\\", "/"),
        formatMismatch: urlExt && urlExt !== ext && !(urlExt === "jpeg" && ext === "jpg") ? `${urlExt} URL, ${ext} bytes` : undefined,
      });
    }
    fs.writeFileSync(path.join(opts.assets, "asset-map.json"), `${JSON.stringify(assets, null, 2)}\n`);
  }

  report.network = [...network.values()].map(({ body: _body, ...rest }) => rest);
  if (assets.length) report.assets = assets;
  fs.writeFileSync(path.join(opts.out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

  const first = report.viewports[opts.widths[0]];
  const summary = [
    `Captured ${opts.url}`,
    `  title: ${first?.title ?? "?"}`,
    `  widths: ${opts.widths.join(", ")}  scrollHeight@${opts.widths[0]}: ${first?.scrollHeight}`,
    `  sections: ${first?.sections.length}  images: ${first?.images.length}  videos: ${first?.videos.length}`,
    `  fonts loaded: ${[...new Set((first?.loadedFonts ?? []).map((f) => f.family))].join(", ") || "none detected"}`,
    `  motion: ${Object.entries(first?.motion ?? {}).filter(([, v]) => v).map(([k]) => k).join(", ") || "none detected"}`,
    `  overflow-x: ${opts.widths.filter((w) => report.viewports[w]?.horizontalOverflow).join(", ") || "none"}`,
    opts.assets ? `  assets: ${assets.filter((a) => a.localPath).length} saved, ${assets.filter((a) => !a.localPath).length} unresolved -> ${opts.assets}` : null,
    `  output: ${opts.out}`,
  ].filter(Boolean);
  process.stdout.write(`${summary.join("\n")}\n`);
}

main().catch((error) => fail(error.stack ?? String(error)));
