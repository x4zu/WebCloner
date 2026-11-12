#!/usr/bin/env node
// mirror-site.mjs — mirror the full deployed asset set of a static-built site (Astro / Vite SSG / Hugo ...) for a 1:1 faithful clone.
// Idea: the "real source" of such sites is not on GitHub, but the deployed static assets (HTML + bundles + CSS + runtime-fetched
//       .sog/.buf/.wasm/.riv/fonts/images) are the truth. A real browser scrolls the whole page, captures every request, and mirrors same-origin assets by path.
// Usage:
//   node scripts/mirror-site.mjs --url <URL> --out <dir> [--scroll-step 700] [--settle 2500] [--max-ms 90000]
// Output:
//   <dir>/site/...                mirrored same-origin assets (paths kept; directory URLs saved as index.html)
//   <dir>/mirror-manifest.json    every request (same-origin + third-party) with status
//   <dir>/own-asset-urls.txt      list of same-origin asset paths
//   <dir>/third-party.json        third-party hosts + webfont CSS (Typekit/Google) that needs self-hosting
// Rule: mirror only assets that were really requested; never invent paths. Third-party CDNs (fonts/wasm/video) are not rewritten automatically; handle them from third-party.json.
//       Manual follow-up: self-host domain-locked fonts (typically a Typekit @import) -> rewrite CSS @import to local -> remove tracking -> serve site/ as the web root.
//       Full recipe: references/static-mirror.md.

import { loadPlaywright, launchChromium } from "./lib/playwright-loader.mjs";
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const o = { url: "", out: "", scrollStep: 700, settle: 2500, maxMs: 90000, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") o.help = true;
    else if (a === "--url") o.url = argv[++i] || "";
    else if (a === "--out") o.out = argv[++i] || "";
    else if (a === "--scroll-step") o.scrollStep = parseInt(argv[++i] || "700", 10);
    else if (a === "--settle") o.settle = parseInt(argv[++i] || "2500", 10);
    else if (a === "--max-ms") o.maxMs = parseInt(argv[++i] || "90000", 10);
  }
  return o;
}

function usage() {
  console.log(`mirror-site.mjs — full asset mirror of a static-built site (1:1 faithful clone)

  node scripts/mirror-site.mjs --url <URL> --out <dir> [--scroll-step 700] [--settle 2500] [--max-ms 90000]

For: Astro / Vite SSG / Hugo / any site whose client runtime ships as downloadable static assets (including WebGL/Canvas-heavy sites).
Not for: true server-rendered / data-driven SPAs (use network-capture.mjs to stub the API).
Recipe and follow-up rewrites (self-host fonts / remove tracking / serve) -> references/static-mirror.md`);
}

// Same-origin asset URL -> local relative path (drop query; directory URLs become index.html)
function urlToLocalPath(u, origin) {
  let p = u.slice(origin.length);
  const q = p.indexOf("?");
  if (q >= 0) p = p.slice(0, q);
  if (p === "" || p.endsWith("/")) p += "index.html";
  return p.replace(/^\/+/, "");
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.url || !args.out) {
  usage();
  process.exit(args.help ? 0 : 1);
}

const origin = new URL(args.url).origin;
const siteDir = path.join(path.resolve(args.out), "site");
fs.mkdirSync(siteDir, { recursive: true });

const responses = new Map(); // url -> {status, type, ct}
const pw = loadPlaywright();
const browser = await launchChromium(pw.chromium);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("response", (resp) => {
  try {
    const h = resp.headers();
    responses.set(resp.url(), { status: resp.status(), type: resp.request().resourceType(), ct: h["content-type"] || "" });
  } catch {}
});

console.log(`▸ loading + scrolling the full page to capture requests: ${args.url}`);
await page.goto(args.url, { waitUntil: "networkidle", timeout: args.maxMs }).catch((e) => console.warn("  goto:", e.message));
const total = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y <= total; y += args.scrollStep) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(180);
}
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(args.settle);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1200);

const all = [...responses.entries()].map(([url, m]) => ({ url, ...m }));
const ownUrls = all.filter((r) => r.url.startsWith(origin + "/") || r.url === origin || r.url === origin + "/");

console.log(`▸ captured ${all.length} requests; ${ownUrls.length} same-origin, downloading...`);
let ok = 0, fail = 0;
const failed = [];
for (const r of ownUrls) {
  const rel = urlToLocalPath(r.url, origin);
  const dest = path.join(siteDir, rel);
  try {
    const resp = await ctx.request.get(r.url); // reuse the browser network stack (same cookies/proxy)
    if (!resp.ok()) { fail++; failed.push(`HTTP${resp.status()} ${rel}`); continue; }
    const buf = await resp.body();
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    ok++;
  } catch (e) {
    fail++; failed.push(`${e.message} ${rel}`);
  }
}

// Third-party hosts + webfont hints
const thirdHosts = [...new Set(all.filter((r) => !r.url.startsWith(origin)).map((r) => { try { return new URL(r.url).host; } catch { return r.url; } }))];
const webfontCss = all.map((r) => r.url).filter((u) => /use\.typekit\.net\/[a-z0-9]+\.css|fonts\.googleapis\.com\/css/i.test(u));
const outRoot = path.resolve(args.out);
fs.writeFileSync(path.join(outRoot, "mirror-manifest.json"), JSON.stringify(all, null, 2));
fs.writeFileSync(path.join(outRoot, "own-asset-urls.txt"), ownUrls.map((r) => urlToLocalPath(r.url, origin)).sort().join("\n") + "\n");
fs.writeFileSync(path.join(outRoot, "third-party.json"), JSON.stringify({ hosts: thirdHosts, webfont_css_to_selfhost: webfontCss }, null, 2));

console.log(`✅ mirror done: ${ok} ok / ${fail} failed -> ${siteDir}`);
if (failed.length) console.log("  ⚠️ failed:\n   " + failed.slice(0, 20).join("\n   "));
console.log(`▸ third-party hosts: ${thirdHosts.join(", ") || "(none)"}`);
if (webfontCss.length) console.log(`▸ webfont CSS to self-host (domain-locked, see static-mirror.md): \n   ${webfontCss.join("\n   ")}`);
console.log(`▸ next: self-host fonts + rewrite CSS @import + remove tracking -> cd ${siteDir} && npx serve -l 8124`);
await browser.close();
