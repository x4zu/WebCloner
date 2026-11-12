#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.log(`Usage:
  node scripts/audit-clone.mjs --project <clone-dir> [--brand "KOKUYO,Original Brand"] [--out CLONE_AUDIT.md]
    [--recon RECON/original-recon.json] [--strict]

Scans clone source files for tracking scripts, original-brand residue, Japanese residue, TODOs, and risky external dependencies.
With --recon, additionally runs fidelity gates against the original recon (fonts self-hosted?
images actually downloaded? key section colors exact?). --strict exits 2 on fidelity findings
so the clone workflow can hard-gate on it.
`);
}

function parseArgs(argv) {
  const out = { project: process.cwd(), brand: [], out: "CLONE_AUDIT.md", recon: "", strict: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--project") out.project = argv[++i] || process.cwd();
    else if (arg === "--brand") out.brand = (argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--out") out.out = argv[++i] || "CLONE_AUDIT.md";
    else if (arg === "--recon") out.recon = argv[++i] || "";
    else if (arg === "--strict") out.strict = true;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

// ---- Fidelity gates (fonts / images / palette vs. the original recon) ------

const GENERIC_FONT_FAMILIES = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui",
  "-apple-system", "blinkmacsystemfont", "segoe ui", "roboto", "helvetica",
  "helvetica neue", "arial", "pingfang sc", "microsoft yahei", "ui-sans-serif",
  "ui-serif", "ui-monospace", "times new roman", "georgia", "courier new",
]);

function customFontFamilies(recon) {
  const first = recon?.captures?.[0]?.signals || {};
  const families = new Set();
  for (const face of first.fontFaces || []) {
    if (face.family) families.add(face.family.trim());
  }
  for (const family of first.fonts || []) {
    const clean = String(family).replace(/['"]/g, "").trim();
    if (clean && !GENERIC_FONT_FAMILIES.has(clean.toLowerCase())) families.add(clean);
  }
  return Array.from(families);
}

// rgb()/rgba()/#hex → "r,g,b"; null for transparent (alpha 0) / unparseable —
// a transparent original color enforces nothing on the clone.
function normalizeColor(value) {
  const v = String(value || "").trim().toLowerCase();
  let m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/);
  if (m) {
    if (m[4] !== undefined && Number(m[4]) === 0) return null;
    return `${m[1]},${m[2]},${m[3]}`;
  }
  m = v.match(/^#([0-9a-f]{3})$/);
  if (m) return m[1].split("").map((c) => parseInt(c + c, 16)).join(",");
  m = v.match(/^#([0-9a-f]{6})/);
  if (m) return [m[1].slice(0, 2), m[1].slice(2, 4), m[1].slice(4, 6)].map((h) => parseInt(h, 16)).join(",");
  return null;
}

// Source files that can carry colors and font wiring. Next.js clones keep colors in .tsx/.css
// and load fonts through next/font/local, so both count.
const STYLE_EXT = new Set([".html", ".css", ".scss", ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".astro"]);
// Harvested source CSS under public/ would make the color gate pass trivially; it is evidence, not the clone.
const isAuthored = (file) => !/[\\/]public[\\/]/.test(file);

function collectCloneColors(files) {
  const colors = new Set();
  for (const file of files) {
    if (!STYLE_EXT.has(path.extname(file).toLowerCase()) || !isAuthored(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/#[0-9a-f]{3}\b|#[0-9a-f]{6}\b|rgba?\([^)]*\)/gi)) {
      const norm = normalizeColor(m[0]);
      if (norm) colors.add(norm);
    }
  }
  return colors;
}

function fidelityFindings(recon, project, files) {
  const findings = [];
  const first = recon?.captures?.[0]?.signals || {};
  const add = (label, detail) => findings.push({ type: "fidelity", label, file: project, line: 0, match: detail });

  // Fonts: the source uses custom fonts -> the clone must ship local font files + @font-face.
  const wantedFamilies = customFontFamilies(recon);
  if (wantedFamilies.length) {
    const fontFiles = files.filter((f) => /\.(woff2?|ttf|otf)$/i.test(f));
    const hasFontFace = files.some((f) => {
      if (!STYLE_EXT.has(path.extname(f).toLowerCase()) || !isAuthored(f)) return false;
      return /@font-face|next\/font\/local|localFont\(|fonts\.css/i.test(fs.readFileSync(f, "utf8"));
    });
    if (!fontFiles.length) {
      add("fonts not self-hosted", `original uses custom fonts (${wantedFamilies.join(", ")}) but the clone ships no local font files — run asset-harvest and link fonts/fonts.css`);
    } else if (!hasFontFace) {
      add("fonts downloaded but unused", `local font files exist but no @font-face or next/font/local references them (${wantedFamilies.join(", ")})`);
    }
  }

  // Images: the source loaded real images -> the clone must ship local image files, not only placeholders.
  const originalImageCount = (first.resources?.images || first.images || []).length;
  if (originalImageCount >= 3) {
    const imageFiles = files.filter((f) => /\.(png|jpe?g|gif|webp|avif)$/i.test(f));
    if (!imageFiles.length) {
      add("images not harvested", `original loaded ${originalImageCount} images but the clone ships zero local image files — placeholders/gradients are not a clone`);
    }
  }

  // Colors: computed colors of key regions (body/header/footer) must appear verbatim in the clone source.
  const cloneColors = collectCloneColors(files);
  for (const key of ["body", "header", "footer"]) {
    const section = first.palette?.[key];
    if (!section) continue;
    for (const prop of ["backgroundColor", "color"]) {
      const norm = normalizeColor(section[prop]);
      if (!norm) continue; // transparent / unparseable — nothing to enforce
      if (!cloneColors.has(norm)) {
        add(`palette mismatch: ${key} ${prop}`, `original computed ${section[prop]} (rgb ${norm}) not found anywhere in the clone source — copy the exact value from recon, do not eyeball`);
      }
    }
  }
  return findings;
}

const includeExt = new Set([".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".txt", ".svg"]);
const skipDirs = new Set([".git", "node_modules", "dist", "build", ".next", ".nuxt", "out", "coverage", "RECON", "docs"]);
const skipFiles = new Set(["NOTES.md", "TEARDOWN.md", "CLONE_REPORT.md", "CLONE_AUDIT.md", "REPLACE_GUIDE.md", "package-lock.json", ".webclone.json", "AGENTS.md", "CLAUDE.md", "asset-map.json", "asset-manifest.json"]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "screenshots") continue;
      walk(full, files);
    } else if (!skipFiles.has(entry.name) && includeExt.has(path.extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

function lineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

function collectMatches(file, text, checks) {
  const findings = [];
  for (const check of checks) {
    const regex = new RegExp(check.pattern, check.flags || "gi");
    for (const match of text.matchAll(regex)) {
      const matchedText = String(match[0]);
      if (check.type === "external" && /^https?:\/\/(www\.)?w3\.org\//i.test(matchedText)) continue;
      findings.push({
        type: check.type,
        label: check.label,
        file,
        line: lineNumber(text, match.index || 0),
        match: matchedText.slice(0, 160),
      });
    }
  }
  return findings;
}

function markdown(findings, project, scannedFiles) {
  const byType = new Map();
  for (const finding of findings) {
    if (!byType.has(finding.type)) byType.set(finding.type, []);
    byType.get(finding.type).push(finding);
  }
  const types = [
    ["fidelity", "Fidelity defects (fonts / images / colors)"],
    ["tracking", "Tracking scripts / analytics pixels"],
    ["brand", "Source brand residue"],
    ["japanese", "Japanese text residue"],
    ["todo", "TODO / placeholder content"],
    ["external", "External dependencies / outbound link risk"],
  ];
  const lines = [
    `# Clone Audit`,
    "",
    `- Project: ${project}`,
    `- Scanned files: ${scannedFiles}`,
    `- Findings: ${findings.length}`,
    "",
  ];

  for (const [type, title] of types) {
    const items = byType.get(type) || [];
    lines.push(`## ${title}`);
    if (!items.length) {
      lines.push("- None found");
      lines.push("");
      continue;
    }
    for (const item of items.slice(0, 200)) {
      lines.push(`- ${path.relative(project, item.file)}:${item.line} · ${item.label} · \`${item.match.replaceAll("`", "'")}\``);
    }
    if (items.length > 200) lines.push(`- ${items.length - 200} more not shown`);
    lines.push("");
  }

  lines.push("## Verdict");
  lines.push(findings.length ? "- Resolve the items above before calling the clone deployable." : "- No obvious residue found; still review asset licensing and visual screenshots manually.");
  return `${lines.join("\n")}\n`;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const project = path.resolve(args.project);
  if (!fs.existsSync(project)) throw new Error(`Project not found: ${project}`);

  const brandPatterns = args.brand.map((brand) => ({
    type: "brand",
    label: `brand residue: ${brand}`,
    pattern: brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    flags: "gi",
  }));

  const checks = [
    { type: "tracking", label: "Google Tag Manager", pattern: "googletagmanager|GTM-[A-Z0-9]+", flags: "gi" },
    { type: "tracking", label: "Google Analytics / gtag", pattern: "google-analytics|gtag\\s*\\(|ga\\s*\\(", flags: "gi" },
    { type: "tracking", label: "Meta Pixel / fbq", pattern: "connect\\.facebook\\.net|fbq\\s*\\(", flags: "gi" },
    { type: "tracking", label: "Hotjar / Clarity", pattern: "hotjar|clarity\\.ms|hj\\s*\\(", flags: "gi" },
    { type: "japanese", label: "Japanese kana residue", pattern: "[\\u3040-\\u30ff]{2,}", flags: "g" },
    { type: "todo", label: "TODO / placeholder content", pattern: "TODO|FIXME|lorem ipsum|placeholder text", flags: "gi" },
    { type: "external", label: "external URL", pattern: "https?://[^\\s\"')<>]+", flags: "gi" },
    ...brandPatterns,
  ];

  const files = walk(project);
  const findings = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    findings.push(...collectMatches(file, text, checks));
  }

  // Font/image/color fidelity gates: enabled only with --recon. walk() skips font/image
  // binaries, so this needs a complete file list that includes them.
  let fidelity = [];
  if (args.recon) {
    const recon = JSON.parse(fs.readFileSync(args.recon, "utf8"));
    const allFiles = [];
    (function walkAll(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (skipDirs.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkAll(full);
        else allFiles.push(full);
      }
    })(project);
    fidelity = fidelityFindings(recon, project, allFiles);
    findings.unshift(...fidelity);
  }

  const output = path.resolve(args.out);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, markdown(findings, project, files.length));
  console.log(output);
  if (fidelity.length) {
    console.error(`⚠️ ${fidelity.length} fidelity defects (see ${path.relative(process.cwd(), output)}):`);
    for (const item of fidelity) console.error(`   - ${item.label}: ${item.match}`);
    if (args.strict) process.exit(2);
  }
} catch (error) {
  console.error(`audit-clone failed: ${error.message}`);
  process.exit(1);
}
