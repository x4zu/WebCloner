# Webclone skill suite v2 (open-design + anthropics/skills merge)
Status: BERJALAN · Service: plugin webclone · Diperbarui: 2026-11-12 12:30

## Sedang dikerjakan
Upgrade plugin `webclone` dengan bahan dari nexu-io/open-design (skill `web-clone` MIT by Jane/@xiaoerzhan,
`craft/` Apache-2.0, `animate`/`gsap-react`/`ui-animation` MIT) dan anthropics/skills (`frontend-design`,
`theme-factory`, Apache-2.0). Sumber di-clone ke scratchpad sesi (hilang bila sesi berakhir; clone ulang --depth 1).

## Status terakhir
- Scripts diport+diterjemah, lolos tes iana.org (recon/harvest/routes/interactions/network/sourcemap/visual-diff/compare/dna/audit). audit-clone disesuaikan Next (tsx, next/font/local, skip docs/, public/ tak dihitung warna). capture.mjs dihapus. motion-probe.mjs BARU (tes OK lenis.darkroom + gsap.com).
- references/: assessment, complex-playbooks, effect-extraction, reverse-engineering, static-mirror, deliverables, design-dna, motion (EN). Placeholder <scripts>/ dipakai di references.
- Script baru: brand-kit.mjs (brand.json -> brand-kit.html + theme.css), fidelity-gate.mjs (per-route gate, exit 3), visual-diff --min-fidelity (fidelityPct, heightDriftPct, gate 3%). LICENSES/ berisi Apache-2.0 + MIT web-clone/animate/gsap-react/ui-animation.
- v1.0.1 live di github.com/x4zu/WebCloner (commit 0a94ba5): /webclone + scaffold.mjs + capture.mjs (Playwright).

## Keputusan penting (disetujui user)
- Commands: /webclone, /webclone-recon, /webclone-audit, /webclone-brand, /webclone-remix,
  /webclone-full (clone seluruh situs, target fidelity 90-100%). Motion = reference di /webclone, BUKAN command.
- Engine browser: port lib CDP open-design (Chrome/Edge sistem, zero-install; pakai playwright bila ada).
  capture.mjs lama diganti recon-site.mjs.
- Skill lain memanggil script via `${CLAUDE_SKILL_DIR}/../webclone/scripts/`.
- Semua teks Mandarin diterjemahkan ke Inggris; kode khusus OpenDesign (daemon, od-preview-rewrite) dibuang.
- Atribusi di THIRD_PARTY_NOTICES.md + LICENSE asli disalin.

## Langkah berikutnya
1. [x] Port scripts web-clone -> skills/webclone/scripts (terjemah, buang OD_*), tes recon di iana.org
2. [x] Port references (assessment, complex-playbooks, deliverables, effect-extraction, reverse-engineering,
       static-mirror, design-dna) + motion refs
3. [x] Tulis ulang skills/webclone/SKILL.md (source-first, L1-L6, mode, fidelity gates, audit)
4. [ ] Skill baru: recon [x], audit [x], full [ ], brand [ ], remix [ ]
5. [x] craft + frontend-design + theme-factory ke webclone-remix/references
6. [ ] README, CHANGELOG 2.0.0, THIRD_PARTY_NOTICES, plugin.json 2.0.0, CI smoke
7. [ ] Tes end-to-end (scaffold+recon+audit), claude plugin validate, commit, push, CI hijau, hapus handoff ini

## Jangan lakukan
- Git Bash mengubah argumen "/x" jadi C:/Program Files/Git/x; fidelity-gate sudah menormalkan, tapi hati-hati di script lain.
- Jangan `node -e "..."` dengan backtick di dalam double quote (shell mengeksekusinya; pernah merusak CHANGELOG).
- Jangan tulis apa pun ke stdout scaffold.mjs selain JSON (npm output -> stderr).
