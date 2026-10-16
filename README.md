# ResumeGauge

**Know what's working. Fix what isn't.**

A free resume score checker. Upload a PDF or DOCX and get a deterministic score out of 100, a breakdown across five weighted categories, prioritized fixes, and every check with the evidence behind it. No AI, no account, no upload — parsing and scoring run entirely in your browser.

> ResumeGauge is a resume-quality assessment tool, not an applicant tracking system. Scores are guidance for improving resume quality and parsing readiness, not a prediction of hiring outcomes or a guarantee of compatibility with every ATS.

## Quick start

Requires Node.js 20.9+ (Node 22 LTS recommended) and npm 10+.

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
| `npm run lint` | ESLint |
| `npm run test` | Run the Vitest suite |
| `npm run test:watch` | Vitest in watch mode |
| `npm run verify` | typecheck + lint + tests + production build |

All five gates (`typecheck`, `lint`, `test`, `build`, runtime smoke test) were run and passing at the time of writing.

## Architecture

The application is deliberately layered so UI, parsing and scoring never mix.

```
src/
  app/                    Next.js App Router routes, metadata, sitemap, robots, OG image
    page.tsx              Landing page (hero, trust, how it works, what we check, FAQ)
    check/page.tsx        Upload + analysis + report route
    how-scoring-works/    Full methodology, ATS explanation, fresher guidance, limitations
    privacy/ terms/ contact/
  components/
    check/                CheckClient: the upload state machine
    layout/               Header, footer, brand, mobile nav, page container
    landing/              Landing page sections
    report/               Report view, score scale, breakdown, priority fixes, marked-up bullets, detailed checks
    resume/               Uploader, parsing progress, recoverable error states
    theme/                Theme provider and three-state toggle
    ui/                   Reusable primitives (button, card, badge, alert, dialog, tooltip, …)
  lib/
    resume/
      file-validation.ts  Extension + size + magic-byte validation (never trusts the MIME type)
      pdf-parser.ts       pdf.js text extraction with page/line structure and image-only page detection
      docx-parser.ts      Mammoth text extraction + OOXML structure inspection (tables, columns, headers)
      text-normalizer.ts  Predictable normalization and text statistics
      section-detector.ts Heading detection from a curated alias list
      contact-detector.ts Email/phone/link detection returning booleans and counts only
      bullet-analyzer.ts  Bullet extraction, per-bullet flags and exact text spans
      date-analyzer.ts    Date families and format consistency
      formatting-analyzer.ts  Observable document signals
      skills-detector.ts  Curated skill-term matching
      analyze.ts          SourceDocument -> ParsedResume -> ScoreReport
      score-engine.ts     Aggregation, coverage disclosure, score bands
      recommendations.ts  Deterministic prioritization
      bullet-insights.ts    Pinpoints which words in a bullet are weak, long or unmeasured
      redact.ts           Removes contact details from anything the report displays
      rules/              The 30 checks in five category modules
      types.ts, constants.ts, report-summary.ts, promise-shims.ts
  config/
    site.ts               Brand, tagline, URLs, contact (rename the product here)
    scoring.ts            Weights, version, thresholds, bands, upload limits
  tests/                  Vitest unit, integration and component-render tests
```

### Pipeline

```
File -> validateResumeFile -> ArrayBuffer -> parser (pdf.js / Mammoth, lazy)
     -> SourceDocument -> buildParsedResume (normalize + detect)
     -> ParsedResume -> scoreResume (30 rules) -> ScoreReport
```

- Parsers load on demand, so pdf.js (~460 kB) and Mammoth (~400 kB) stay out of the landing page bundle.
- `ParsedResume` never contains raw emails, phone numbers or URLs — only booleans and counts — so the report cannot leak contact details.
- The scoring engine is pure: same input + same `SCORING_VERSION` ⇒ same score.

## Scoring methodology

Five weighted categories, 30 checks, 100 points total:

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
- A small inline script in the document `<head>` applies the class before first paint, so there is no flash of the wrong theme.
- System mode follows `prefers-color-scheme: dark` live.
- All colors are semantic tokens defined once in `src/app/globals.css` (`--color-desk`, `--color-sheet`, `--color-ink`, `--color-rule`, `--color-mark`, plus the five status tones `--color-pass`, `--color-caution`, `--color-issue`, `--color-note`, `--color-mute` and their `-wash` / `-deep` variants) and consumed through Tailwind utilities. The dark theme is a separate palette, not an inversion, and components never hardcode hex values.
- A domain value is mapped to a colour in exactly one place, `src/components/ui/tones.ts`. A tone is only applied when a real result stands behind it — check status, severity, fix priority, score band, parsing-note severity, found vs. not found. Pure measurements (the score figure, file names, page and word counts, tick labels) stay ink, and category identity is deliberately not colour-coded.
- The design system follows one rule: a page is a sheet of paper on a desk, ink means *act*, colour means *a result was found*, and every score is drawn as a measurement rather than a progress bar. Tokens live in `src/app/globals.css`; domain-to-colour mapping lives in `src/components/ui/tones.ts`.

## Privacy

- The file and the extracted text are never uploaded, logged, stored in `localStorage`, placed in URLs, or sent to analytics or error-reporting tools.
- Nothing persists beyond the current tab; “Remove resume and clear results” and “Clear report” discard document data immediately.
- Uploaded files are treated as untrusted: extension + size + magic-byte validation, no execution of document content, and extracted text is never rendered as HTML.
- Nothing in the report displays a contact detail. The marked-up bullet ledger renders whole lines, so emails, phone numbers and links are redacted to `[email removed]` / `[phone removed]` / `[link removed]` at the display boundary. The scoring engine still reads the real text, so a redacted email still counts as detected.
- No AI service, OCR service or paid API is used anywhere.

## Testing

144 tests across unit, integration and component rendering:

- `tests/text-normalizer.test.ts`, `section-detector.test.ts`, `contact-detector.test.ts`, `bullet-analyzer.test.ts`, `date-analyzer.test.ts`, `bullet-insights.test.ts`
- `tests/scoring.test.ts`, `score-engine.test.ts` — rule outcomes, score boundaries, repeatability, coverage disclosure, no-guarantee language, fresher fairness
- `tests/file-validation.test.ts` — magic bytes, size limits, renamed files
- `tests/integration-pipeline.test.ts` — real generated PDF and DOCX bytes through the parsers, full `analyzeResumeFile` flow, error paths, determinism
- `tests/report-render.test.ts` — renders the real `ReportView` in jsdom with real computed reports, including filter behavior and print expansion
- `tests/uploader.test.tsx` — renders the real `ResumeUploader` in jsdom: button opens the picker, chosen files reach the parent, ref `browse()` works, disabled state holds
- `tests/theme.test.tsx` — renders the real `ThemeProvider` and `ThemeToggle` in jsdom: light/dark/system resolution, `localStorage` persistence and the `<html>` class
- `tests/document-fixtures.ts`, `tests/resume-fixtures.ts` — synthetic fixtures only; no real resumes or personal data

Not included: browser end-to-end tests (Playwright/Cypress). Everything that can run without a browser is covered here; E2E is the recommended next step if the project grows.

## Deployment notes

- Set `NEXT_PUBLIC_SITE_URL` to the real domain before launch (see `.env.example`): it drives canonical tags, Open Graph URLs, the sitemap and robots. Production builds fail fast while the URL still contains `example.com`.
- Set `NEXT_PUBLIC_CONTACT_EMAIL` to the real contact address.
- Security headers (CSP without `unsafe-eval`, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`) ship from `next.config.ts`.
- `npm run build && npm run start` serves a fully static-friendly production build (all current routes are prerendered; `/check` is also marked `noindex` because report data is client-only).
