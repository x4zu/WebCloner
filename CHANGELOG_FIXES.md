# Catatan Perbaikan (terbaru → terlama)

### Fix #8 — Lint clone gagal/berisik karena bukti riset di docs/
| | |
|---|---|
| Tanggal | 2026-11-12 |
| File | `skills/webclone/template/eslint.config.mjs` |
| Masalah | `npm run check` di clone TaskGo me-lint `docs/research/.../source/wf-webflow.*.js` (JS Webflow hasil unduhan) → puluhan warning `no-unused-expressions` |
| Akar | Template hanya meng-ignore `.next/`, `out/`, `build/`; workflow menyimpan HTML/JS/CSS pihak ketiga di `docs/` dan `public/` |
| Fix | `globalIgnores` + `docs/**` dan `public/**` |
| Verifikasi | Clone TaskGo: `npm run check` exit 0, 0 warning |
| Pelajaran | Folder bukti/aset hasil unduhan bukan kode project; template harus mengecualikannya dari tooling |
| Log Keyword | eslint, globalIgnores, docs, template, taskgo |
| Deploy | v2.0.2 |

### Fix #7 — motion-probe membuang nilai awal (startAt) animasi GSAP
| | |
|---|---|
| Tanggal | 2026-11-12 |
| File | `skills/webclone/scripts/motion-probe.mjs` |
| Masalah | Tween GSAP tercatat `"startAt":"[object]"` dan `"stagger":"[object]"`, jadi posisi "from" (mis. opacity 0, skewX 30deg) tidak diketahui |
| Akar | Semua nilai objek di `vars` diratakan menjadi string "[object]" |
| Fix | Objek dangkal disimpan dengan field primitifnya (kecuali `parent`/`data`) |
| Verifikasi | taskgo-oly.webflow.io: 11 tween terbaca lengkap, mis. teams-block `{y:"40%",skewX:"9deg"}` → `{y:"0%",skewX:"0deg"}` stagger each 0.2; heading letters `{opacity:0,skewX:"30deg"}` stagger amount 0.5 |
| Pelajaran | Probe motion harus menyimpan nilai from/to, bukan hanya to |
| Log Keyword | motion-probe, startAt, stagger, gsap, taskgo |
| Deploy | v2.0.2 |

### Fix #6 — asset-harvest: fonts.css tetap menunjuk ke fonts.gstatic.com
| | |
|---|---|
| Tanggal | 2026-11-12 |
| File | `skills/webclone/scripts/asset-harvest.mjs` |
| Masalah | `fonts.css` untuk Inter Tight berisi 3 URL `https://fonts.gstatic.com/...ttf` walau font sudah "terunduh" (font tidak self-hosted) |
| Akar | CSS Google Fonts bergantung user-agent: salinan yang diambil script mendaftar `.ttf`, browser memuat `.woff2` dengan URL lain, sehingga peta URL→lokal tidak cocok |
| Fix | Sebelum rewrite, setiap `url()` di CSS webfont yang belum ada di peta diunduh langsung ke `fonts/<host>/` lalu dipetakan |
| Verifikasi | TaskGo: 3 URL remote → 0; `fonts.css` menunjuk ke `fonts.gstatic.com/<file>.ttf` lokal; audit strict tanpa defect font |
| Pelajaran | CSS webfont harus diperlakukan sebagai bergantung UA; unduh referensinya sendiri |
| Log Keyword | asset-harvest, fonts.css, google fonts, user-agent, taskgo |
| Deploy | v2.0.2 |

### Fix #5 — Screenshot viewport selalu menangkap bagian atas halaman (lib CDP hasil port)
| | |
|---|---|
| Tanggal | 2026-11-12 |
| File | `skills/webclone/scripts/lib/system-browser.mjs` |
| Masalah | `page.screenshot()` (non-fullPage) setelah scroll ke 30%/60% menghasilkan gambar bagian atas dokumen. Berdampak pada screenshot state scroll di `interaction-probe` dan script lain yang memakai viewport shot |
| Akar | `Page.captureScreenshot` dipanggil dengan `clip {x:0,y:0}` + `captureBeyondViewport: true`, jadi koordinat clip relatif ke dokumen, bukan ke posisi scroll |
| Fix | Viewport shot tanpa clip dan `captureBeyondViewport: false`; full-page tetap memakai clip + captureBeyondViewport |
| Verifikasi | poliwangi.ac.id 1440px: sebelum, shot 30% dan 60% identik dengan hero. Sesudah, 20/40/60/80/100% menampilkan section berbeda (kartu, pengumuman, agenda, footer); visual-diff source vs clone per posisi 99.34–100% |
| Pelajaran | Adapter "Playwright-compatible" harus diuji perilakunya (scroll + screenshot), bukan hanya bentuk API-nya |
| Log Keyword | screenshot, captureBeyondViewport, clip, system-browser, CDP |
| Deploy | ✅ LIVE 2026-11-12 v2.0.1 (commit 8c2c67c, CI run 43154750892 hijau) |

### Fix #4 — fidelity-gate: route "/x" jadi "C:/Program Files/Git/x" di Git Bash
| | |
|---|---|
| Tanggal | 2026-11-12 |
| File | `skills/webclone/scripts/fidelity-gate.mjs` |
| Masalah | `--routes /help/example-domains,/domains` → route pertama gagal `net::ERR_NAME_NOT_RESOLVED` |
| Akar | MSYS (Git Bash) mengonversi argumen yang diawali `/` menjadi path Windows |
| Fix | `normalizeRoute()` membuang prefix `<drive>:/.../Git` dan menambah `/` di depan route tanpa slash |
| Verifikasi | Sebelum: 1/2 route lulus (1 error). Sesudah: 2/2 lulus, 100% di 1440 dan 390 |
| Pelajaran | Script CLI yang menerima path URL wajib tahan konversi MSYS; di skill lain gunakan `MSYS_NO_PATHCONV=1` bila perlu |
| Log Keyword | msys, pathconv, fidelity-gate, webclone-skill-suite |
| Deploy | ✅ LIVE 2026-11-12 v2.0.0 (commit 0806018, CI run 43152701186 hijau) |

### Fix #3 — visual-diff lolos untuk layout berbeda di halaman dominan putih
| | |
|---|---|
| Tanggal | 2026-11-12 |
| File | `skills/webclone/scripts/visual-diff.mjs` |
| Masalah | Screenshot 1440 vs 390 (layout berbeda) mendapat fidelity 94.98% → lolos gate 90% |
| Akar | Rasio piksel berbeda longgar pada latar putih; tinggi halaman (910px vs 1220px) tidak diperiksa. `heightDriftPct` sempat dihitung setelah JSON ditulis sehingga `undefined` di fidelity-gate |
| Fix | Gate `--min-fidelity` juga mensyaratkan selisih tinggi ≤ 3%; `heightDriftPct` dihitung sebelum JSON ditulis |
| Verifikasi | Kasus 1440 vs 390 sekarang ditolak (height drift 34.07%); identik tetap 100% / h0% |
| Pelajaran | Skor piksel saja tidak cukup; selalu gabungkan dengan geometri halaman dan lihat diff image |
| Log Keyword | visual-diff, heightDrift, min-fidelity, webclone-skill-suite |
| Deploy | ✅ LIVE 2026-11-12 v2.0.0 (commit 0806018, CI run 43152701186 hijau) |

### Fix #2 — motion-probe gagal di situs GSAP: "Object reference chain is too long"
| | |
|---|---|
| Tanggal | 2026-11-12 |
| File | `skills/webclone/scripts/motion-probe.mjs` |
| Masalah | gsap.com: probe crash, tidak ada output |
| Akar | `vars.ease`/`stagger`/targets GSAP berupa fungsi/objek sirkular; CDP `returnByValue` tidak bisa menserialisasi |
| Fix | Hasil dibungkus `safe()` (JSON replacer: fungsi → "[function]", Element → selector, sirkular → "[circular]") di dalam halaman |
| Verifikasi | gsap.com: GSAP v3.15.0, 80 tween, 7 ScrollTrigger terbaca; lenis.darkroom.engineering: transition 1200ms cubic-bezier(0.19, 1, 0.22, 1) terbaca |
| Pelajaran | Semua `page.evaluate` yang membaca objek library harus menserialisasi sendiri di dalam halaman |
| Log Keyword | motion-probe, CDP, serialization, gsap, webclone-skill-suite |
| Deploy | ✅ LIVE 2026-11-12 v2.0.0 (commit 0806018, CI run 43152701186 hijau) |

### Fix #1 — audit-clone menolak clone Next.js yang benar (port dari web-clone)
| | |
|---|---|
| Tanggal | 2026-11-12 |
| File | `skills/webclone/scripts/audit-clone.mjs` |
| Masalah | Gate fidelity hanya memindai `.html`/`.css`; warna di `.tsx` dan font via `next/font/local` / `fonts.css` yang di-link tidak dihitung → defect palsu. Sebaliknya CSS hasil harvest di `public/` dan bukti recon di `docs/` bisa membuat gate warna lolos palsu |
| Akar | Skrip asli dirancang untuk clone statis `index.html` di OpenDesign |
| Fix | `STYLE_EXT` mencakup js/jsx/ts/tsx/vue/svelte/astro; font dianggap terpasang bila ada `@font-face`, `next/font/local`, `localFont(` atau `fonts.css`; file di `public/` diabaikan untuk warna; `docs/`, `out/`, manifest, lockfile dilewati |
| Verifikasi | example.com: template kosong → exit 2 (warna body rgb(0,0,0) tidak ada); setelah token persis ditambahkan ke `globals.css` → exit 0, "None found". iana.org: 2 defect nyata terdeteksi (font tak dipakai, warna body) |
| Pelajaran | Gate yang diport dari stack lain harus diuji dua arah (harus gagal dan harus lulus) di stack tujuan |
| Log Keyword | audit-clone, strict, fidelity gate, next/font, webclone-skill-suite |
| Deploy | ✅ LIVE 2026-11-12 v2.0.0 (commit 0806018, CI run 43152701186 hijau) |
