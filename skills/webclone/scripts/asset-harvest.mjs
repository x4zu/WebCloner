#!/usr/bin/env node
// asset-harvest.mjs — pull every image/font/media file the target page actually uses onto disk.
//
// Why a real browser instead of plain fetch:
//   1. Big sites serve images/fonts from third-party CDNs (static.nike.com / use.typekit.net /
//      fonts.gstatic.com ...) with hotlink protection (referer/UA/cookie checks). A bare fetch with a
//      bot UA gets 403; reusing the browser network stack (same UA/cookies/protocol) looks like a real visitor.
//   2. Lazy images (loading=lazy / data-src / IntersectionObserver) only request after a real scroll.
//   3. CSS background-image, @font-face, and srcset/picture variants are requested on demand while
//      rendering; static HTML parsing misses them. Listening to network responses gives the full set in use.
//
// Usage (preferred, capture with --url):
//   node scripts/asset-harvest.mjs --url <URL> --out assets [--recon RECON/original-recon.json]
//     [--types image,font,media,stylesheet] [--max-bytes 26214400] [--download-timeout 10000]
//     [--navigation-timeout 30000] [--concurrency 8] [--scroll-step 700] [--settle 2500]
// Legacy usage (--recon-only: no browser capture, plain download of URLs listed in the recon JSON):
//   node scripts/asset-harvest.mjs --recon original-recon.json --out assets/original --recon-only
//
// Output:
//   <out>/images/<host>/<name>   all images (third-party CDNs, srcset variants, CSS backgrounds)
//   <out>/fonts/<host>/<name>    all font binaries (woff2/woff/ttf/otf)
//   <out>/fonts/fonts.css        self-hosted @font-face (webfont CSS + @font-face rules rewritten to local paths)
//   <out>/media/<host>/<name>    audio/video (limited by --max-bytes)
//   <out>/asset-manifest.json    full originalUrl -> localPath map with per-item status
//     Replace references mechanically from the manifest when building; never write external URLs from memory.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadPlaywright, launchChromium } from "./lib/playwright-loader.mjs";

function usage() {
  console.log(`asset-harvest.mjs — download the images/fonts/media a page really uses (including third-party CDNs) and map them locally

  node scripts/asset-harvest.mjs --url <URL> --out assets [--recon RECON/original-recon.json]
    [--types image,font,media,stylesheet] [--max-bytes 26214400] [--download-timeout 10000]
    [--navigation-timeout 30000] [--concurrency 8] [--scroll-step 700] [--settle 2500]

Output: <out>/{images,fonts,media}/<host>/<name> + <out>/fonts/fonts.css (self-hosted @font-face)
      + <out>/asset-manifest.json (originalUrl -> localPath; replace references from it when building)`);
}

function parseArgs(argv) {
  const out = {
    url: "",
    recon: "",
    outDir: "assets",
    manifest: "",
    types: ["image", "font", "media", "stylesheet"],
    maxBytes: 25 * 1024 * 1024,
    downloadTimeout: 10_000,
    navigationTimeout: 30_000,
    concurrency: 8,
    scrollStep: 700,
    settle: 2500,
    reconOnly: false,
    allExternal: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--url") out.url = argv[++i] || "";
    else if (arg === "--recon") out.recon = argv[++i] || "";
    else if (arg === "--out") out.outDir = argv[++i] || "assets";
    else if (arg === "--manifest") out.manifest = argv[++i] || "";
    else if (arg === "--types") out.types = (argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--max-bytes") out.maxBytes = Number(argv[++i] || out.maxBytes);
    else if (arg === "--download-timeout") out.downloadTimeout = Number(argv[++i] || "10000");
    else if (arg === "--navigation-timeout") out.navigationTimeout = Number(argv[++i] || "30000");
    else if (arg === "--concurrency") out.concurrency = Math.max(1, Number(argv[++i] || "8"));
    else if (arg === "--scroll-step") out.scrollStep = Number(argv[++i] || "700");
    else if (arg === "--settle") out.settle = Number(argv[++i] || "2500");
    else if (arg === "--recon-only") out.reconOnly = true;
    else if (arg === "--all-external") out.allExternal = true;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

const FONT_EXT = /\.(woff2?|ttf|otf|eot)(?:$|[?#])/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)(?:$|[?#])/i;
const MEDIA_EXT = /\.(mp4|webm|m4v|mov|mp3|ogg|wav)(?:$|[?#])/i;
const WEBFONT_CSS = /use\.typekit\.net\/[a-z0-9]+\.css|fonts\.googleapis\.com\/css/i;

function classify(url, resourceType, contentType) {
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("font/") || ct.includes("font-woff") || FONT_EXT.test(url)) return "font";
  if (ct.startsWith("image/") || resourceType === "image" || IMAGE_EXT.test(url)) return "image";
  if (ct.startsWith("video/") || ct.startsWith("audio/") || resourceType === "media" || MEDIA_EXT.test(url)) return "media";
  if (ct.includes("text/css") || resourceType === "stylesheet") return "stylesheet";
  return null;
}

function safeName(url) {
  const parsed = new URL(url);
  const ext = path.extname(parsed.pathname).slice(0, 12);
  const base = path.basename(parsed.pathname, ext).replace(/[^a-z0-9._-]+/gi, "-").slice(0, 80) || "asset";
  const hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 10);
  return `${base}-${hash}${ext || ".bin"}`;
}

function localPathFor(kind, url) {
  const host = new URL(url).hostname.replace(/[^a-z0-9.-]+/gi, "-");
  const dir = kind === "image" ? "images" : kind === "font" ? "fonts" : kind === "media" ? "media" : "css";
  return path.join(dir, host, safeName(url));
}

// URLs visible statically in the recon JSON (img src/srcset, @font-face src, stylesheets):
// a fallback for the network capture (e.g. resources that appear after the first screenshot).
function urlsFromRecon(recon) {
  const urls = new Map(); // url -> hinted kind
  const add = (raw, kind, base) => {
    if (!raw) return;
    try {
      const abs = new URL(raw, base || recon.url).href;
      if (/^https?:/i.test(abs) && !urls.has(abs)) urls.set(abs, kind);
    } catch {}
  };
  for (const capture of recon.captures || []) {
    const signals = capture.signals || {};
    for (const image of signals.images || []) {
      add(image.src, "image");
      for (const candidate of String(image.srcset || "").split(",")) {
        add(candidate.trim().split(/\s+/)[0], "image");
      }
    }
    for (const face of signals.fontFaces || []) {
      for (const src of face.srcUrls || []) add(src, "font", face.sheetHref);
    }
    for (const href of signals.stylesheets || []) add(href, "stylesheet");
    for (const url of signals.resources?.images || []) add(url, "image");
    for (const url of signals.resources?.fonts || []) add(url, "font");
    for (const url of signals.resources?.media || []) add(url, "media");
  }
  return urls;
}

// Rewrite url(...) in webfont CSS / @font-face source CSS to local font paths and
// merge everything into one fonts.css that a page can <link> directly.
function rewriteFontCss(cssText, cssUrl, urlToLocal) {
  return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, ref) => {
    try {
      const abs = new URL(ref, cssUrl).href;
      const local = urlToLocal.get(abs);
      if (!local) return match;
      // fonts.css lives in <out>/fonts/ and the fonts in <out>/fonts/<host>/,
      // so relative references drop the leading "fonts/".
      const rel = path.relative("fonts", local).split(path.sep).join("/");
      return `url(${quote}${rel}${quote})`;
    } catch {
      return match;
    }
  });
}

async function downloadAll(entries, ctx, args, refererUrl) {
  const results = new Array(entries.length);
  const outDir = path.resolve(args.outDir);
  let nextIndex = 0;
  let completed = 0;
  const downloadOne = async (entry) => {
    const rel = localPathFor(entry.kind, entry.url);
    const dest = path.join(outDir, rel);
    try {
      const fetchAsset = async () => {
        const resp = ctx
          ? await ctx.request.get(entry.url, {
              headers: { referer: refererUrl },
              maxRedirects: 5,
              timeout: args.downloadTimeout,
            })
          : await fetch(entry.url, {
              headers: { referer: refererUrl, accept: "*/*" },
              signal: AbortSignal.timeout(args.downloadTimeout),
            });
        const ok = ctx ? resp.ok() : resp.ok;
        const status = ctx ? resp.status() : resp.status;
        if (!ok) throw new Error(`HTTP ${status}`);
        return ctx ? resp.body() : Buffer.from(await resp.arrayBuffer());
      };
      let timeoutId;
      const buffer = await Promise.race([
        fetchAsset(),
        new Promise((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error(`download timed out after ${args.downloadTimeout}ms`)),
            args.downloadTimeout,
          );
        }),
      ]).finally(() => clearTimeout(timeoutId));
      if (buffer.length > args.maxBytes) throw new Error(`exceeds --max-bytes (${buffer.length})`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buffer);
      return { ...entry, status: "ok", bytes: buffer.length, localPath: rel.split(path.sep).join("/") };
    } catch (error) {
      return { ...entry, status: "error", error: error.message };
    }
  };
  const worker = async () => {
    while (nextIndex < entries.length) {
      const index = nextIndex++;
      results[index] = await downloadOne(entries[index]);
      completed += 1;
      if (completed % 10 === 0 || completed === entries.length) {
        console.log(`  download progress ${completed}/${entries.length}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(args.concurrency, entries.length) }, worker));
  return results;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.url && !args.recon)) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const recon = args.recon ? JSON.parse(fs.readFileSync(args.recon, "utf8")) : null;
  const pageUrl = args.url || recon?.url || "";
  if (!pageUrl) throw new Error("need --url or a recon JSON with a url");

  // Candidate assets: network capture (authoritative) + recon static list (fallback).
  const candidates = new Map(); // url -> {kind, via}
  const addCandidate = (url, kind, via) => {
    if (!kind || !args.types.includes(kind)) return;
    if (!candidates.has(url)) candidates.set(url, { url, kind, via });
  };

  let ctx = null;
  let browser = null;
  if (!args.reconOnly) {
    const pw = loadPlaywright();
    browser = await launchChromium(pw.chromium);
    ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on("response", (resp) => {
      try {
        const kind = classify(resp.url(), resp.request().resourceType(), resp.headers()["content-type"]);
        if (kind) addCandidate(resp.url(), kind, "network");
      } catch {}
    });
    console.log(`▸ loading + scrolling the full page to capture asset requests: ${pageUrl}`);
    await page.goto(pageUrl, {
      waitUntil: "domcontentloaded",
      timeout: args.navigationTimeout,
    }).catch((e) => console.warn("  goto:", e.message));
    await page.waitForLoadState("networkidle", {
      timeout: Math.min(args.navigationTimeout, 5_000),
    }).catch(() => {});
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y <= total; y += args.scrollStep) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(180);
    }
    await page.waitForTimeout(args.settle);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
  }

  if (recon) {
    for (const [url, kind] of urlsFromRecon(recon)) addCandidate(url, kind, "recon");
  }

  const entries = Array.from(candidates.values());
  const fontCount = entries.filter((e) => e.kind === "font").length;
  const imageCount = entries.filter((e) => e.kind === "image").length;
  console.log(`▸ ${entries.length} candidate assets (images ${imageCount} / fonts ${fontCount}), downloading...`);

  const results = await downloadAll(entries, ctx, args, pageUrl);

  // Self-hosted @font-face: fetch webfont CSS (Typekit/Google Fonts) + @font-face rules from the recon,
  // rewrite url() to local font paths, and merge them into one fonts.css.
  const urlToLocal = new Map(
    results.filter((r) => r.status === "ok").map((r) => [r.url, r.localPath]),
  );
  const fontCssBlocks = [];
  const webfontCssUrls = results.filter((r) => r.kind === "stylesheet" && WEBFONT_CSS.test(r.url));
  for (const cssAsset of webfontCssUrls) {
    try {
      const cssText = fs.readFileSync(path.join(path.resolve(args.outDir), cssAsset.localPath), "utf8");
      fontCssBlocks.push(`/* self-hosted from ${cssAsset.url} */\n${rewriteFontCss(cssText, cssAsset.url, urlToLocal)}`);
    } catch {}
  }
  for (const capture of recon?.captures || []) {
    for (const face of capture.signals?.fontFaces || []) {
      if (!face.cssText) continue;
      fontCssBlocks.push(rewriteFontCss(face.cssText, face.sheetHref || pageUrl, urlToLocal));
    }
  }
  if (fontCssBlocks.length) {
    const fontsDir = path.join(path.resolve(args.outDir), "fonts");
    fs.mkdirSync(fontsDir, { recursive: true });
    fs.writeFileSync(path.join(fontsDir, "fonts.css"), `${Array.from(new Set(fontCssBlocks)).join("\n\n")}\n`);
  }

  const manifestFile = path.resolve(args.manifest || path.join(args.outDir, "asset-manifest.json"));
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  const okCount = results.filter((r) => r.status === "ok").length;
  const errCount = results.length - okCount;
  fs.writeFileSync(manifestFile, `${JSON.stringify({
    url: pageUrl,
    capturedVia: args.reconOnly ? "recon-only" : "browser-network+recon",
    total: results.length,
    ok: okCount,
    error: errCount,
    fontsCss: fontCssBlocks.length ? "fonts/fonts.css" : null,
    assets: results,
  }, null, 2)}\n`);

  if (browser) await browser.close();
  console.log(`✅ ${okCount} downloaded / ${errCount} failed -> ${path.resolve(args.outDir)}`);
  if (fontCssBlocks.length) console.log(`▸ self-hosted font styles: ${path.join(args.outDir, "fonts/fonts.css")} (import it from the page)`);
  const failedFonts = results.filter((r) => r.kind === "font" && r.status === "error");
  if (failedFonts.length) console.log(`⚠️ ${failedFonts.length} font downloads failed. Do not fall back to system fonts; check each one:\n   ${failedFonts.map((f) => `${f.error} ${f.url}`).slice(0, 10).join("\n   ")}`);
  console.log(manifestFile);
} catch (error) {
  console.error(`asset-harvest failed: ${error.message}`);
  process.exit(1);
}
