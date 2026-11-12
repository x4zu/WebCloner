#!/usr/bin/env node
// motion-probe.mjs — read the source page's real motion values instead of guessing them.
//
// Collects, at several scroll positions:
//   - document.getAnimations(): CSS animations/transitions and WAAPI (name, duration, delay, easing, iterations, keyframes)
//   - elements with a non-trivial computed `transition` (property, duration, timing function, delay)
//   - GSAP: version, global timeline children (duration, ease, vars), ScrollTrigger instances (trigger, start, end, scrub, pin, snap)
//   - Lenis / Locomotive options, scroll-behavior, scroll-snap rules, sticky/fixed elements
//   - @keyframes rules from readable stylesheets
//
// Usage:
//   node scripts/motion-probe.mjs --url <URL> --out <dir> [--label original] [--width 1440] [--height 900]
//     [--positions 0,0.25,0.5,0.75,1] [--wait 1500] [--navigation-timeout 45000]
// Output: <out>/<label>-motion.json and <out>/<label>-motion.md
//
// Part of the webclone plugin (MIT). Uses the zero-dependency CDP adapter from web-clone by Jane (@xiaoerzhan, MIT).

import fs from "node:fs";
import path from "node:path";
import { launchChromium, loadPlaywright } from "./lib/playwright-loader.mjs";

function usage() {
  console.log(`Usage:
  node scripts/motion-probe.mjs --url <URL> --out <dir> [--label original] [--width 1440] [--height 900]
    [--positions 0,0.25,0.5,0.75,1] [--wait 1500] [--navigation-timeout 45000]

Outputs <out>/<label>-motion.json and <out>/<label>-motion.md with measured animation,
transition, GSAP/ScrollTrigger, Lenis, and scroll-snap values.`);
}

function parseArgs(argv) {
  const out = { url: "", outDir: "", label: "original", width: 1440, height: 900, positions: [0, 0.25, 0.5, 0.75, 1], waitMs: 1500, navigationTimeoutMs: 45000 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i] ?? "";
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--url") out.url = next();
    else if (arg === "--out") out.outDir = next();
    else if (arg === "--label") out.label = next();
    else if (arg === "--width") out.width = Number(next()) || 1440;
    else if (arg === "--height") out.height = Number(next()) || 900;
    else if (arg === "--positions") out.positions = next().split(",").map(Number).filter((n) => n >= 0 && n <= 1);
    else if (arg === "--wait") out.waitMs = Number(next()) || 0;
    else if (arg === "--navigation-timeout") out.navigationTimeoutMs = Number(next()) || 45000;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

// Runs in the page. Must stay self-contained (serialized by CDP).
function collectMotion() {
  const describe = (el) => {
    if (typeof el === "function") return "[function]";
    if (el === window) return "window";
    if (!el || !el.tagName) return String(el ?? "").slice(0, 80);
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "";
    const framer = el.getAttribute?.("data-framer-name");
    return `${el.tagName.toLowerCase()}${id}${cls}${framer ? `[data-framer-name="${framer}"]` : ""}`.slice(0, 160);
  };

  const animations = (document.getAnimations?.() || []).slice(0, 120).map((anim) => {
    const effect = anim.effect;
    const timing = effect?.getTiming?.() || {};
    let keyframes = [];
    try {
      keyframes = (effect?.getKeyframes?.() || []).slice(0, 6).map((frame) => {
        const copy = {};
        for (const [key, value] of Object.entries(frame)) if (!["computedOffset", "composite"].includes(key)) copy[key] = value;
        return copy;
      });
    } catch {
      keyframes = [];
    }
    return {
      kind: anim.constructor?.name || "Animation",
      name: anim.animationName || anim.transitionProperty || anim.id || "",
      target: describe(effect?.target),
      playState: anim.playState,
      duration: timing.duration,
      delay: timing.delay,
      easing: timing.easing,
      iterations: timing.iterations,
      direction: timing.direction,
      fill: timing.fill,
      keyframes,
    };
  });

  const transitions = [];
  const all = document.querySelectorAll("body *");
  for (let i = 0; i < all.length && transitions.length < 80; i += 1) {
    const el = all[i];
    const cs = getComputedStyle(el);
    const durations = cs.transitionDuration.split(",").map((d) => parseFloat(d) || 0);
    if (!durations.some((d) => d > 0)) continue;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    transitions.push({
      target: describe(el),
      property: cs.transitionProperty,
      duration: cs.transitionDuration,
      timingFunction: cs.transitionTimingFunction,
      delay: cs.transitionDelay,
    });
  }

  const keyframeRules = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules || [])) {
      if (rule.type === CSSRule.KEYFRAMES_RULE && keyframeRules.length < 40) keyframeRules.push({ name: rule.name, css: rule.cssText.slice(0, 600) });
    }
  }

  const win = window;
  let gsap = null;
  if (win.gsap) {
    const tweens = [];
    try {
      for (const child of win.gsap.globalTimeline.getChildren(true, true, true).slice(0, 80)) {
        const vars = {};
        for (const [key, value] of Object.entries(child.vars || {})) {
          if (typeof value === "function") vars[key] = "[function]";
          else if (value && typeof value === "object" && !Array.isArray(value)) {
            // Keep the shallow primitive fields: startAt holds the "from" values, stagger its timing.
            const shallow = {};
            for (const [k, v] of Object.entries(value)) if (["string", "number", "boolean"].includes(typeof v)) shallow[k] = v;
            vars[key] = key === "parent" || key === "data" ? "[object]" : shallow;
          }
          else vars[key] = value;
        }
        const targets = typeof child.targets === "function" ? child.targets().slice(0, 4).map(describe) : [];
        tweens.push({ type: child.constructor?.name || (child.getChildren ? "Timeline" : "Tween"), duration: child.duration?.(), delay: child.delay?.(), ease: child.vars?.ease, repeat: child.vars?.repeat, stagger: child.vars?.stagger, targets, vars });
      }
    } catch (error) {
      tweens.push({ error: String(error) });
    }
    gsap = { version: win.gsap.version, tweens };
  }

  let scrollTriggers = null;
  const ST = win.ScrollTrigger || win.gsap?.plugins?.scrollTrigger;
  if (ST?.getAll) {
    scrollTriggers = ST.getAll().slice(0, 60).map((st) => ({
      trigger: describe(st.trigger),
      start: st.start,
      end: st.end,
      startVar: st.vars?.start,
      endVar: st.vars?.end,
      scrub: st.vars?.scrub,
      pin: st.vars?.pin ? describe(st.pin || st.vars.pin) : false,
      snap: st.vars?.snap ? JSON.stringify(st.vars.snap).slice(0, 120) : undefined,
      toggleActions: st.vars?.toggleActions,
    }));
  }

  const lenisInstance = win.lenis || win.__lenis || win.Lenis?.instance;
  const lenis = lenisInstance?.options
    ? Object.fromEntries(Object.entries(lenisInstance.options).filter(([, v]) => typeof v !== "object" && typeof v !== "function").map(([k, v]) => [k, v]))
    : document.documentElement.classList.contains("lenis") ? { detected: "html.lenis class, instance not exposed" } : null;
  const locomotive = document.documentElement.classList.contains("has-scroll-smooth") || document.querySelector("[data-scroll-container]") ? { detected: true } : null;

  const snapContainers = [];
  const sticky = [];
  for (let i = 0; i < all.length; i += 1) {
    const cs = getComputedStyle(all[i]);
    if (cs.scrollSnapType && cs.scrollSnapType !== "none" && snapContainers.length < 10) snapContainers.push({ target: describe(all[i]), scrollSnapType: cs.scrollSnapType });
    if ((cs.position === "sticky" || cs.position === "fixed") && sticky.length < 20) sticky.push({ target: describe(all[i]), position: cs.position, top: cs.top, zIndex: cs.zIndex });
  }

  // Library objects (eases, staggers, DOM nodes) can be functions or circular; flatten before CDP serializes.
  const seen = new WeakSet();
  const safe = (value) => JSON.parse(JSON.stringify(value, (_key, v) => {
    if (typeof v === "function") return "[function]";
    if (v && typeof v === "object") {
      if (v instanceof Element) return describe(v);
      if (seen.has(v)) return "[circular]";
      seen.add(v);
    }
    return v;
  }));

  return safe({
    scrollY: Math.round(window.scrollY),
    scrollHeight: document.documentElement.scrollHeight,
    htmlScrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    htmlScrollSnap: getComputedStyle(document.documentElement).scrollSnapType,
    reducedMotionQuery: matchMedia("(prefers-reduced-motion: reduce)").matches,
    animations,
    transitions,
    keyframeRules,
    gsap,
    scrollTriggers,
    lenis,
    locomotive,
    snapContainers,
    sticky,
  });
}

function writeSummary(file, result) {
  const first = result.samples[0]?.data || {};
  const lines = [
    `# Motion probe: ${result.label}`,
    "",
    `- URL: ${result.url}`,
    `- Viewport: ${result.viewport.width}x${result.viewport.height}`,
    `- scroll-behavior: ${first.htmlScrollBehavior}; scroll-snap: ${first.htmlScrollSnap}`,
    `- Lenis: ${first.lenis ? JSON.stringify(first.lenis) : "not detected"}`,
    `- Locomotive: ${first.locomotive ? "detected" : "not detected"}`,
    `- GSAP: ${first.gsap ? `v${first.gsap.version}, ${first.gsap.tweens.length} tweens/timelines` : "not detected"}`,
    `- ScrollTrigger: ${first.scrollTriggers ? `${first.scrollTriggers.length} instances` : "not detected"}`,
    `- Sticky/fixed elements: ${first.sticky?.length ?? 0}; snap containers: ${first.snapContainers?.length ?? 0}`,
    "",
    "## Samples by scroll position",
  ];
  for (const sample of result.samples) {
    const d = sample.data;
    lines.push(`### ${Math.round(sample.position * 100)}% (scrollY ${d.scrollY})`);
    lines.push(`- running animations: ${d.animations.length}`);
    for (const a of d.animations.slice(0, 12)) lines.push(`  - ${a.kind} \`${a.name}\` on \`${a.target}\`: ${a.duration}ms, delay ${a.delay}ms, ${a.easing}, iterations ${a.iterations}`);
  }
  lines.push("", "## Transitions (first sample)");
  for (const t of (first.transitions || []).slice(0, 30)) lines.push(`- \`${t.target}\`: ${t.property} ${t.duration} ${t.timingFunction} delay ${t.delay}`);
  if (first.scrollTriggers?.length) {
    lines.push("", "## ScrollTriggers");
    for (const st of first.scrollTriggers) lines.push(`- \`${st.trigger}\`: start ${st.startVar ?? st.start} end ${st.endVar ?? st.end} scrub ${st.scrub ?? false} pin ${st.pin}`);
  }
  if (first.keyframeRules?.length) {
    lines.push("", "## @keyframes");
    for (const k of first.keyframeRules.slice(0, 20)) lines.push(`- ${k.name}`);
  }
  lines.push("", "Copy these values into the clone. Mark anything measured from video/screenshots instead as an estimate.");
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
}

let browser = null;
try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.url || !args.outDir) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const outDir = path.resolve(args.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const { chromium } = loadPlaywright();
  browser = await launchChromium(chromium);
  const page = await browser.newPage({ viewport: { width: args.width, height: args.height }, deviceScaleFactor: 1 });
  await page.goto(args.url, { waitUntil: "load", timeout: args.navigationTimeoutMs });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  if (args.waitMs) await page.waitForTimeout(args.waitMs);

  const samples = [];
  for (const position of args.positions) {
    await page.evaluate((p) => window.scrollTo(0, Math.round((document.documentElement.scrollHeight - window.innerHeight) * p)), position);
    await page.waitForTimeout(700);
    samples.push({ position, data: await page.evaluate(collectMotion) });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await browser.close();
  browser = null;

  const result = { label: args.label, url: args.url, capturedAt: new Date().toISOString(), viewport: { width: args.width, height: args.height }, samples };
  const jsonFile = path.join(outDir, `${args.label}-motion.json`);
  fs.writeFileSync(jsonFile, `${JSON.stringify(result, null, 2)}\n`);
  writeSummary(path.join(outDir, `${args.label}-motion.md`), result);
  console.log(jsonFile);
} catch (error) {
  console.error(`motion-probe failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
}
