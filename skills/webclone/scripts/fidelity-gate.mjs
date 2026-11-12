#!/usr/bin/env node
// fidelity-gate.mjs — per-route, per-viewport pixel gate between a source site and a local clone.
//
// For every route: full-page screenshots of source and clone at each width (source shots are cached),
// visual-diff with --min-fidelity, then a FIDELITY.md table. Exits 3 when any route/width is below the gate.
//
// Usage:
//   node scripts/fidelity-gate.mjs --origin https://example.com --local http://localhost:3000 --out <dir>
//     [--route-map <original-route-map.json>] [--routes /,/about,/pricing] [--widths 1440,768,390]
//     [--min-fidelity 90] [--refresh-source] [--only /pricing]
// Routes come from --routes, else from --route-map (route-crawl output), else "/".
// Part of the webclone plugin (MIT).

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));

function usage() {
  console.log(`Usage:
  node scripts/fidelity-gate.mjs --origin <source origin> --local <clone origin> --out <dir>
    [--route-map original-route-map.json] [--routes /,/about] [--widths 1440,768,390]
    [--min-fidelity 90] [--refresh-source] [--only /path]

Gate per route and width: fidelityPct >= min, meanAbsDiff <= 0.05, page height within 3%.
Writes <out>/FIDELITY.md and <out>/fidelity.json; exits 3 if any check fails.`);
}

function parseArgs(argv) {
  const out = { origin: "", local: "", out: "", routeMap: "", routes: [], widths: [1440, 768, 390], minFidelity: 90, refreshSource: false, only: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i] ?? "";
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--origin") out.origin = next().replace(/\/$/, "");
    else if (arg === "--local") out.local = next().replace(/\/$/, "");
    else if (arg === "--out") out.out = next();
    else if (arg === "--route-map") out.routeMap = next();
    else if (arg === "--routes") out.routes = next().split(",").map((r) => r.trim()).filter(Boolean);
    else if (arg === "--widths") out.widths = next().split(",").map(Number).filter(Boolean);
    else if (arg === "--min-fidelity") out.minFidelity = Number(next()) || 90;
    else if (arg === "--refresh-source") out.refreshSource = true;
    else if (arg === "--only") out.only = next();
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function routesFrom(args) {
  if (args.routes.length) return args.routes;
  if (args.routeMap && fs.existsSync(args.routeMap)) {
    const map = JSON.parse(fs.readFileSync(args.routeMap, "utf8"));
    const origin = new URL(args.origin).host;
    const paths = (map.routes || [])
      .filter((r) => !r.status || r.status < 400)
      .map((r) => new URL(r.url))
      .filter((u) => u.host === origin)
      .map((u) => `${u.pathname}${u.search}`);
    return [...new Set(paths)];
  }
  return ["/"];
}

// Git Bash (MSYS) rewrites a leading "/x" argument into "C:/Program Files/Git/x"; undo that and
// accept routes written without a leading slash.
function normalizeRoute(route) {
  let value = route.replace(/^[A-Za-z]:[\\/].*?[\\/]Git(?=[\\/])/, "");
  if (!value.startsWith("/")) value = `/${value}`;
  return value;
}

const slugOf = (route) => route.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 80) || "home";

function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], { encoding: "utf8" });
  return { code: result.status ?? 1, stdout: result.stdout || "", stderr: result.stderr || "" };
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.origin || !args.local || !args.out) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const outDir = path.resolve(args.out);
  fs.mkdirSync(outDir, { recursive: true });
  let routes = [...new Set(routesFrom(args).map(normalizeRoute))];
  if (args.only) routes = routes.filter((r) => r === normalizeRoute(args.only));
  const widths = args.widths.join(",");
  const rows = [];

  for (const route of routes) {
    const slug = slugOf(route);
    const dir = path.join(outDir, slug);
    const shots = path.join(dir, "screenshots");
    const sourceReady = args.widths.every((w) => fs.existsSync(path.join(shots, `original-${w}.png`)));
    process.stdout.write(`▸ ${route} `);
    if (!sourceReady || args.refreshSource) {
      const r = run("recon-site.mjs", ["--url", `${args.origin}${route}`, "--out", dir, "--label", "original", "--widths", widths]);
      if (r.code !== 0) {
        rows.push({ route, slug, error: `source recon failed: ${r.stderr.trim().split("\n").pop()}` });
        console.log("source failed");
        continue;
      }
    }
    const c = run("recon-site.mjs", ["--url", `${args.local}${route}`, "--out", dir, "--label", "clone", "--widths", widths]);
    if (c.code !== 0) {
      rows.push({ route, slug, error: `clone recon failed: ${c.stderr.trim().split("\n").pop()}` });
      console.log("clone failed");
      continue;
    }
    const cells = [];
    for (const w of args.widths) {
      const json = path.join(dir, `visual-diff-${w}.json`);
      const d = run("visual-diff.mjs", ["--original", path.join(shots, `original-${w}.png`), "--clone", path.join(shots, `clone-${w}.png`), "--out", json, "--diff", path.join(shots, `visual-diff-${w}.png`), "--min-fidelity", String(args.minFidelity)]);
      const data = fs.existsSync(json) ? JSON.parse(fs.readFileSync(json, "utf8")) : {};
      cells.push({ width: w, pass: d.code === 0, fidelityPct: data.fidelityPct, score: data.visualScore, meanAbsDiff: data.meanAbsDiff, heightDriftPct: data.heightDriftPct, diff: path.relative(outDir, path.join(shots, `visual-diff-${w}.png`)) });
    }
    const pass = cells.every((cell) => cell.pass);
    rows.push({ route, slug, pass, cells });
    console.log(cells.map((cell) => `${cell.width}:${cell.fidelityPct}%${cell.pass ? "" : "✗"}`).join(" "));
  }

  const failed = rows.filter((r) => !r.pass);
  const lines = [
    "# Fidelity gate",
    "",
    `- Source: ${args.origin} · Clone: ${args.local}`,
    `- Gate: fidelity >= ${args.minFidelity}%, meanAbsDiff <= 0.05, height drift <= 3% at ${widths}`,
    `- Result: ${rows.length - failed.length}/${rows.length} routes pass`,
    "",
    `| Route | ${args.widths.map((w) => `${w}`).join(" | ")} | Pass |`,
    `|---|${args.widths.map(() => "---").join("|")}|---|`,
    ...rows.map((r) => r.error
      ? `| ${r.route} | ${args.widths.map(() => "-").join(" | ")} | ❌ ${r.error} |`
      : `| ${r.route} | ${r.cells.map((c) => `${c.fidelityPct}% (${c.score}) h${c.heightDriftPct}%`).join(" | ")} | ${r.pass ? "✅" : "❌"} |`),
    "",
    "Diff images: `<route>/screenshots/visual-diff-<width>.png`. Pixel ratio is lenient on mostly blank pages; always open the diff images.",
  ];
  fs.writeFileSync(path.join(outDir, "FIDELITY.md"), `${lines.join("\n")}\n`);
  fs.writeFileSync(path.join(outDir, "fidelity.json"), `${JSON.stringify({ origin: args.origin, local: args.local, minFidelity: args.minFidelity, widths: args.widths, rows }, null, 2)}\n`);
  console.log(`${path.join(outDir, "FIDELITY.md")}\n${rows.length - failed.length}/${rows.length} routes pass`);
  if (failed.length) process.exit(3);
} catch (error) {
  console.error(`fidelity-gate failed: ${error.message}`);
  process.exit(1);
}
