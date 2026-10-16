# ResumeGauge — Application Audit

**Date:** 2026-10-15
**Scope:** Full codebase review of `resume-checker` (ResumeGauge v0.1.0)
**Verification performed:** `tsc --noEmit` ✅ clean · `eslint .` ✅ clean · `vitest run` ✅ 139/139 tests pass

---

## 1. What the app is

A fully client-side, privacy-first resume checker (Next.js 15 / React 19 / TypeScript strict / Tailwind v4). Files (PDF/DOCX, ≤5 MB) are parsed entirely in the browser (pdf.js + Mammoth), scored against **31 deterministic checks** in 5 weighted categories, and rendered as a report with marked-up evidence. No backend, no database, no AI, no network calls with user data.

**Overall assessment: this is a high-quality project.** Strict TS with `noUncheckedIndexedAccess`, magic-byte file validation, redaction at the display boundary, real-payload integration tests, typed error codes, and a clean `verify` gate. The shortcomings below are mostly polish, duplication, and launch-readiness items — not structural flaws.

---

## 2. Shortcomings & required improvements

### A. Launch blockers (must fix before going public)

| # | Issue | Evidence | Improvement |
|---|-------|----------|-------------|
| A1 | **Placeholder site config shipped.** Canonical URLs, OG tags, sitemap, and robots all point to `https://resumegauge.example.com`; contact email is `hello@resumegauge.example.com`. | `src/config/site.ts:18,21` | Set the real domain and email before deploy. Consider failing the build if `siteConfig.url` still contains `example.com` when `NODE_ENV === "production"`. |
| A2 | **`dev.log` committed at repo root.** Leaks local details (LAN IP `169.254.189.218`, PID, project path) and is stale noise. Not in `.gitignore`. | `dev.log` (5.5 KB) | Delete it and add `*.log` to `.gitignore`. |
| A3 | **No security headers / CSP.** `next.config.ts` is empty — no CSP, `X-Frame-Options`, `Referrer-Policy`, or `Permissions-Policy`. A client-only app handling user documents should ship a strict CSP. | `next.config.ts` | Add a `headers()` config: CSP (no `unsafe-eval`; pdf.js already sets `isEvalSupported: false`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, frame-ancestors `none`. |
| A4 | **Repo hygiene:** the project is not a git repository; `.kilo/` AI-tooling metadata (including an unrelated "Data" agent definition) and `skills/` live inside the product tree. | `.kilo/`, `skills/` | `git init`, move AI-tooling out of the product tree (or gitignore it), commit a clean initial state. |
| A5 | **No CI.** `npm run verify` exists but nothing enforces it. | no `.github/workflows` | Add a GitHub Actions workflow running `npm run verify` on PR/push. |

### B. Code quality issues

| # | Issue | Evidence | Improvement |
|---|-------|----------|-------------|
| B1 | **Broken formatting from a past CRLF incident:** two statements jammed onto one line (works, but clearly an unfixed edit artifact). | `src/lib/resume/analyze.ts:34` (`const parsingWarnings = [...];  if (duplicateTexts.length > 0) {`) | Split onto separate lines; run Prettier once over the repo to prevent recurrence (no formatter is configured). |
| B2 | **Double-scoring of the same fact.** `structure-skills-section` (structure, 3 pts) and `skills-section-detected` (skills, 6 pts) implement near-identical pass/warning/issue logic with near-identical copy — a user loses up to **9 points for one missing skills section**. | `rules/structure.ts:114`, `rules/skills.ts:8` | Merge into one check, or make structure check *presence of any skill-bearing section* and skills check *quality/breadth* so they measure different things. Re-balance category weights if points are removed. |
| B3 | **Duplicated heading-case logic.** `readability-heading-consistency` re-implements casing classification inline instead of reusing the exported `headingCaseStyle`/`headingStyleShare` helpers used elsewhere. | `rules/readability.ts:239–258` vs `section-detector.ts` | Refactor the rule to call the shared helpers. |
| B4 | **Two parallel analysis systems overlap.** `formatting-analyzer.ts` (14 signals) re-derives line length, blank runs, replacement chars, date formats, heading style, and bullets — all of which the readability checks recompute. Signals are only shown in the snapshot, never scored; the duplicated computation can drift out of sync. | `formatting-analyzer.ts`, `rules/readability.ts` | Compute observations **once** in the analyzer, pass them into the score engine as inputs to the checks. |
| B5 | **Dead exports** (defined + exported, never imported in src or tests): `getCheck`, `sectionTitles`, `RELEVANCE_LIMIT_NOTE`, `DATE_FAMILY_LABELS`; `DateAnalysis.dominantFamily`/`dominantShare` computed but the rule recomputes family counts itself. | `rules/index.ts:17`, `rules/helpers.ts:135,146`, `date-analyzer.ts:114` | Remove dead exports or use them; wire `dominantFamily` into the readability rule instead of recomputing. |
| B6 | **No formatter configured.** Lint passes but style consistency relies on eyeballing; B1-style glitches survive. | no Prettier config | Add Prettier + a `format` script (optionally lint-staged + Husky). |

### C. Product & feature gaps

| # | Issue | Improvement |
|---|-------|-------------|
| C1 | **No OCR / image-only PDFs rejected.** Scanned resumes get a "no extractable text" error with no path forward. | Short term: make the error message suggest converting to a text-based PDF. Longer term: optional client-side OCR (e.g. Tesseract.js) — or explicitly document the limitation on `/check`. |
| C2 | **No E2E tests.** Unit/integration/component coverage is strong (139 tests) but the actual upload → parse → report flow in a real browser is untested; pdf.js worker loading and drag-drop are exactly where browsers diverge. README acknowledges this. | Add Playwright: happy-path PDF, happy-path DOCX, rejected file types, corrupted file, clear-report flow, print stylesheet smoke. |
| C3 | **Report state is lost on refresh/navigation.** Everything lives in React state for the tab session. | Persist the (redacted) `ScoreReport` to `sessionStorage` so a refresh doesn't wipe the user's results; make sure redaction applies before persistence. |
| C4 | **No shareable/exportable output beyond print/clipboard.** | Consider "download report as Markdown/JSON" (deterministic, no PII after redaction) and/or a shareable anonymous link if a backend is ever added. |
| C5 | **Scoring transparency is good but versioning is passive.** `SCORING_VERSION = "1.1.0"` is stamped on reports, but there's no changelog for how scores changed between versions. | Add a `SCORING_CHANGELOG` section on `/how-scoring-works` so users seeing a different score than last month understand why. |
| C6 | **DOCX page count is an estimate (550 words/page)** baked into a scored check — a user can be penalized/heavily credited on an approximation. | Downgrade page-count for DOCX to a `warning`/informational check, or state the estimation clearly in the check's explanation text. |
| C7 | **No analytics at all** (privacy-positive), so you can't tell which checks misfire or where users drop off. | If you ever add analytics, keep them cookie-free/self-hosted (e.g. Plausible/Umami) and gate them behind an explicit privacy note — the current privacy page promises no tracking. |

### D. Documentation discrepancies

| # | Issue | Fix |
|---|-------|-----|
| D1 | README links to `NEW-UI-STYLE.md` — **the file does not exist** (`README.md:118`). | Create the file or remove/replace the link. |
| D2 | README claims **"115 tests"** (`README.md:130`) — actual count is **139** `it()` blocks across 12 suites. | Update the number (or say "139 tests" dynamically / drop the exact count). |
| D3 | `.gitignore` whitelists `!.env.example` but no `.env.example` exists. | Add a minimal `.env.example` (even if empty/commented) or drop the exception. |

### E. Minor / low priority

- **`toAppError` passes raw `Error.message` to the UI** for unknown errors (`src/lib/utils/errors.ts`) — low risk client-side, but map unknown errors to a generic message and log details to the console instead.
- **`redact.ts` phone regex is broad** and may redact non-phone digit runs (e.g. `20261015`) — errs on the privacy-safe side, acceptable, but worth a test documenting the intent.
- **`pdfjs` `standardFontDataUrl` warning** appears in test output — pass the parameter in the parser config to silence it and avoid garbled font rendering on some PDFs.
- **`constants.ts` is 582 lines** of dictionaries — fine as data, but consider moving the verb/skill/buzzword lists to JSON files so non-devs can extend them.
- **Largest rules files** (`structure.ts` ~397, `content.ts` ~385, `readability.ts` ~328 lines) are readable but each check is a candidate for its own file if the set grows past ~10 per category.
- **No Prettier/Husky** (see B6); no Dependabot/renovate for the 20+ dependencies.

---

## 3. What's already strong (keep it)

- **Privacy by construction:** parsers run client-side; contact detection returns booleans only; `redact.ts` masks PII at the display boundary with an offset map; tests assert "never displays personal contact data."
- **Deterministic scoring:** same input ⇒ same score (tested), versioned, weights sum to exactly 100, unverifiable checks excluded from the denominator with coverage disclosure.
- **File validation:** extension + size + **magic bytes**; MIME never trusted; pdf.js `isEvalSupported: false`; no `innerHTML` anywhere.
- **Error handling:** typed `AppError` codes, retryable flags, 60 s parse timeout, password/corrupt/empty/no-text paths all covered by tests.
- **Testing:** 139 tests including real generated PDF/DOCX payloads through the full pipeline, determinism checks, and jsdom component renders.
- **Accessibility & theming:** skip link, `aria-live` phases, native `<details>` accordions (print-friendly), no-flash theme script, three-state theme.
- **SEO completeness:** per-page metadata, OG image, sitemap, robots, canonical — all config-driven.

---

## 4. Recommended priority order

1. **A1–A5** — launch blockers (config, logs, headers, git, CI).
2. **B1, B2, B6** — fix the formatting artifact, de-duplicate the double-penalized skills check, add a formatter.
3. **D1–D3** — README/env-doc fixes (5 minutes).
4. **C1, C3** — better no-text UX, sessionStorage report persistence.
5. **B3–B5** — refactor overlaps and remove dead exports.
6. **C2** — Playwright E2E as the next major testing investment.
7. **C4–C7** — feature/strategic items as the product matures.
