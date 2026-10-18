# ResumeGauge

**Know what's working. Fix what isn't.**

A free resume score checker. Upload a PDF or DOCX and get a deterministic score out of 100, a breakdown across five weighted categories, prioritized fixes, and every check with the evidence behind it. No AI, no account, no upload — parsing and scoring run entirely in your browser.

> ResumeGauge is a resume-quality assessment tool, not an applicant tracking system. Scores are guidance for improving resume quality and parsing readiness, not a prediction of hiring outcomes or a guarantee of compatibility with every ATS.

## Quick start

Requires Node.js 20.9+ (Node 22 LTS recommended) and npm 10+. The floor is declared as `"engines": { "node": ">=20.9.0" }` in `package.json`, and CI runs the suite on Node 20, 22 and 24.

```bash
npm install
npm run dev        # http://localhost:3000
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run lint` | ESLint, failing on warnings as well as errors |
| `npm run format:check` | Prettier check (advisory — see below) |
| `npm run verify` | typecheck + lint + production build |

`verify` is three gates: `typecheck`, `lint`, `build`. All three run in CI on every push to `main` and every pull request, alongside `npm audit`, a bundle-size budget on the pdf.js worker, and a runtime smoke test that starts the built server and asserts the routes, the security headers and `robots.txt` actually say what this README claims.

`format:check` is deliberately **not** one of the four gates. Prettier's `printWidth` was corrected from 100 to 120 to match how the code is actually written, but the repository has never been reformatted end to end: **100 of the tracked files** still differ from Prettier's output on at least one line, so the check cannot be blocking until a `npm run format` pass has been reviewed and committed on its own. It runs in CI with `continue-on-error` so the remaining drift stays visible instead of invisible.

## Architecture

The application is deliberately layered so UI, parsing and scoring never mix.

```
src/
  app/                    Next.js App Router routes, metadata, sitemap, robots, OG image
    page.tsx              Landing page (hero, trust, how it works, what we check, FAQ)
    check/page.tsx        Upload + analysis + report route (noindex)
    check/loading.tsx     Route-level loading state for the check page
    how-scoring-works/    Full methodology, ATS explanation, fresher guidance, limitations
    error.tsx             Route-level error boundary, rendered as a recoverable state
    global-error.tsx      Last-resort boundary (no layout available)
    privacy/ terms/ contact/
  components/
    check/                CheckClient: the upload state machine
    layout/               Header, footer, brand, mobile nav, page container
    landing/              Landing page sections
    report/               Report view, score scale, breakdown, priority fixes, marked-up bullets, detailed checks
    resume/               Uploader, parsing progress, recoverable error states
    theme/                Theme provider and three-state toggle
    ui/                   Reusable primitives (button, badge, alert, empty state, section heading, page container, dialog, accordion, spinner)
  lib/
    resume/
      types.ts            The shared data model for every stage below
      constants.ts        Detection dictionaries (skill terms, weak phrases, action verbs)
      file-validation.ts  Extension + size + magic-byte validation (never trusts the MIME type)
      pdf-parser.ts       pdf.js text extraction with page/line structure and image-only page detection
      docx-parser.ts      Mammoth text extraction + OOXML structure inspection (tables, columns, headers)
      text-normalizer.ts  Predictable normalization and text statistics
      section-detector.ts Heading detection from a curated alias list
      contact-detector.ts Email/phone/link detection returning booleans and counts only
      bullet-analyzer.ts  Bullet extraction, per-bullet flags and exact text spans
      date-analyzer.ts    Date families and format consistency
      metric-parser.ts    Classifies the numbers in a bullet by what they actually measure
      formatting-analyzer.ts  Observable document signals
      skills-detector.ts  Curated skill-term matching
      analyze.ts          SourceDocument -> ParsedResume (pure, sync)
      analyze-file.ts     File -> ScoreReport: validate, parse, score, with a whole-run time budget
      score-engine.ts     Aggregation, coverage disclosure, score bands
      recommendations.ts  Deterministic prioritization
      bullet-insights.ts  Pinpoints which words in a bullet are weak, long or unmeasured
      report-summary.ts   The plain-text summary the report can copy out
      redact.ts           Removes contact details from anything the report displays
      promise-shims.ts    Loaded before pdfjs-dist; no-op on Node versions that need no shim
      rules/              The 36 checks in five category modules
  config/
    site.ts               Brand, tagline, URLs, contact (rename the product here)
    scoring.ts            Weights, version, thresholds, bands, upload limits
    theme-init.ts         The one inline theme script, exported so the CSP can hash it
```

### Pipeline

```
File -> validateResumeFile -> ArrayBuffer -> parser (pdf.js / Mammoth, lazy)
     -> SourceDocument -> buildParsedResume (normalize + detect)
     -> ParsedResume -> scoreResume (36 rules) -> ScoreReport
```

- Parsers load on demand, so neither is in the landing-page bundle. The real cost is deferred rather than avoided, though: `pdf.min.mjs` is **435,381 bytes**, and the moment a PDF is parsed the browser also fetches the bundled **1,232,303-byte** worker that `pdf-parser.ts` points `GlobalWorkerOptions.workerSrc` at. First PDF analysis therefore costs about **1.67 MB** of transfer, not the ~460 kB an earlier version of this README claimed. Mammoth is 405,060 bytes and is loaded the same lazy way. CI fails the build if the worker grows past 1.5 MB.
- **Contact detection returns booleans and counts only, so the score never needs the raw value.** `ParsedResume` itself does keep the verbatim text — `rawText`, `normalizedText`, `sections[].content`, `bullets[].text` — because the rules reason over it. The privacy guarantee is enforced at the *display* boundary instead: `redact.ts` runs on the way out, so nothing marked as a contact detail ever reaches the DOM.
- The scoring engine is pure: same input + same `SCORING_VERSION` ⇒ same score. `SCORING_VERSION` is currently `1.3.0`. ESLint enforces this by rejecting `Math.random`, `Date.now` and `new Date()` anywhere under `lib/resume/` or in `config/scoring.ts`.

## Scoring methodology

Five weighted categories, **36 checks**, 100 points total. `ALL_CHECKS` in `lib/resume/rules/index.ts` is the single source of that count, and every page that states it reads it from there rather than hardcoding a number. The current scoring version is `1.3.0`.

| Category | Weight |
| --- | ---: |
| Structure and completeness | 20 |
| Content and bullet quality | 25 |
| Contact and professional profile | 15 |
| Readability and formatting | 20 |
| Skills and relevance signals | 20 |

Point policy:

- `pass` earns full points, `warning` earns half, `issue` earns none.
- `unable-to-verify` and `not-applicable` remove the check's points from both the earned and possible totals. The overall score is computed over the points that could be evaluated, and the report always discloses how many checks were evaluated and excluded.
- Recommendation priority is a deterministic function of severity, recoverable points and detection confidence. Recoverable points are the maximum a specific change could recover — an estimate of one change, never a predicted final score.

Documented limitations (also on `/how-scoring-works`): no OCR for scanned or image-only PDFs, DOCX page counts are estimated from word count, skill detection uses a fixed curated list, bullet analysis recognizes explicit bullet markers, and there is no job-description matching because relevance cannot be assessed without a target role.

## Theme system

Three-state selector: **Light**, **Dark**, **System**.

- Preference is stored in `localStorage` under `resumegauge-theme` and restored on return.
- A small inline script in the document `<head>` applies the class before first paint, so there is no flash of the wrong theme. It is the only inline script on the site, it is the one carve-out to the no-`innerHTML` rule, and it lives in `src/config/theme-init.ts` so `next.config.ts` can hash the exact same string into the CSP rather than keep two copies in sync.
- System mode follows `prefers-color-scheme: dark` live.
- All colors are semantic tokens defined once in `src/app/globals.css` (`--color-desk`, `--color-sheet`, `--color-ink`, `--color-rule`, `--color-mark`, plus the five status tones `--color-pass`, `--color-caution`, `--color-issue`, `--color-note`, `--color-mute`). Each of the first four carries both a `-wash` and a `-deep` variant; **`--color-mute` carries only `-wash`** — there is no `--color-mute-deep` in either theme, and an earlier version of this README claimed there was. Both palettes are defined as a dark theme rather than an inversion of the light one, and components never hardcode hex values.
- A domain value is mapped to a colour in exactly one place, `src/components/ui/tones.ts`. A tone is only applied when a real result stands behind it — check status, severity, fix priority, score band, parsing-note severity, found vs. not found. Pure measurements (the score figure, file names, page and word counts, tick labels) stay ink, and category identity is deliberately not colour-coded.
- The design system follows one rule: a page is a sheet of paper on a desk, ink means *act*, colour means *a result was found*, and every score is drawn as a measurement rather than a progress bar. Tokens live in `src/app/globals.css`; domain-to-colour mapping lives in `src/components/ui/tones.ts`.

## Privacy

- The file and the extracted text are never uploaded, logged, stored in `localStorage`, placed in URLs, or sent to analytics or error-reporting tools.
- Nothing persists beyond the current tab; “Remove resume and clear results” and “Clear report” discard document data immediately.
- Uploaded files are treated as untrusted: extension + size + magic-byte validation, no execution of document content, and extracted text is never rendered as HTML. The single `dangerouslySetInnerHTML` in the app is the hashed theme script in `layout.tsx`; nothing derived from a document ever reaches it. ESLint rejects the attribute everywhere else in `src/`.
- Nothing in the report displays a contact detail. The marked-up bullet ledger renders whole lines, so emails, phone numbers and links are redacted to `[email removed]` / `[phone removed]` / `[link removed]` at the display boundary. The scoring engine still reads the real text, so a redacted email still counts as detected.
- No AI service, OCR service or paid API is used anywhere. The network primitives that could reach one — `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon` — are banned by lint rule across `src/`, not by convention.

## Testing

There is no test suite in the repository right now. It is being written after the feature work settles, so the scaffolding is not sitting half-finished next to the code it is meant to cover. `vitest` and `jsdom` are no longer dependencies, `vitest.config.ts` is gone, and the `test` / `test:watch` scripts are gone with them. `verify` is therefore three gates, not four.

What CI still covers without a unit suite:

- **`npm audit`** (advisory) — `pdfjs-dist@^5` parses untrusted binary input in the browser, which makes the dependency tree security-relevant, and every direct dependency is on a caret range.
- **A bundle-size budget** — the pdf.js worker is 1,232,303 bytes and CI fails above 1.5 MB.
- **A runtime smoke test** — starts the real production server and asserts the routes answer, the security headers actually ship, and `robots.txt` / `sitemap.xml` say what this README says they say.

Browser end-to-end tests (Playwright/Cypress) are also not included. The upload → parse → score → render flow is only exercised manually, so it is the first thing to write when the suite comes back.

## Deployment notes

- Set `NEXT_PUBLIC_SITE_URL` to the real domain before launch (see `.env.example`): it drives canonical tags, Open Graph URLs, the sitemap and robots. Production builds fail fast while the URL still contains `example.com`.
- Set `NEXT_PUBLIC_CONTACT_EMAIL` to the real contact address.
- Security headers all ship from `next.config.ts`: `Content-Security-Policy`, `Strict-Transport-Security` (2 years, `includeSubDomains`, preloaded), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `X-DNS-Prefetch-Control`, and `poweredByHeader: false`.
- The production CSP carries **no `unsafe-eval` and no `unsafe-inline`**. `script-src` allows the theme script by its **sha256 hash**, computed in `next.config.ts` from the same `THEME_INIT_SCRIPT` string the page inlines — so editing the script cannot silently break the page, and no second injected `<script>` can run either. `'unsafe-eval'` / `'unsafe-inline'` / `ws:` are added in development only, for React Refresh and HMR.
- `npm run build && npm run start` serves a fully static-friendly production build: all current routes are prerendered.
- **Known contradiction worth deciding on.** `/check` is described three different ways, and this is not a documentation slip — it is three sources disagreeing:
  - `check/page.tsx` sets `robots: { index: false, follow: true }`, i.e. `noindex`.
  - `robots.ts` **disallows** `/check` outright, which stops crawlers reaching it at all.
  - `sitemap.ts` **lists** `/check` at `priority: 0.9`, the second-highest priority on the site.

  `disallow` wins in practice for anything that honours `robots.txt`, so the sitemap entry is currently the odd one out. Either drop `/check` from the sitemap, or drop the `disallow` and keep `noindex` + a sitemap hint. Until someone picks, the honest position is: `/check` is not being indexed.
- `sitemap.ts` stamps `lastModified: new Date()` on all six URLs, so **every rebuild republishes a fresh `lastmod` for the whole site** even when nothing changed. Search engines read that as constantly-changing content and will crawl more often than they should. The fix is to commit a per-route date (or drop `lastModified`), which is a change to `src/app/sitemap.ts`. `site-footer.tsx` has the same shape with `new Date().getFullYear()`, though a copyright year changing once a year is harmless.
