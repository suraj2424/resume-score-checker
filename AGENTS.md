# AGENTS.md

Guidance for AI agents working in this repo. Read this before editing anything.

`README.md` already documents the product, architecture, scoring methodology, theme system, privacy model, test inventory, and deployment. **Read it rather than duplicating it here.** This file covers only the conventions and constraints that are easy to violate.

---

## 1. What this is

**ResumeGauge** — a deterministic, privacy-first resume scorer. PDF/DOCX is parsed entirely in the browser, scored by a pure rule engine, and never leaves the tab. There is no backend, no API route, no AI, no analytics, no account.

Pipeline (do not reorder or bypass these stages):

```
File
  → validateResumeFile      (zod schema + magic bytes)
  → ArrayBuffer
  → parser (lazy import)    (pdf-parser | docx-parser)
  → SourceDocument
  → buildParsedResume       (pure, sync)
  → ParsedResume
  → scoreResume             (30 pure rules)
  → ScoreReport
  → redactContact           (display boundary only)
```

---

## 2. Hard constraints

Violating any of these breaks the product promise, not just the code.

1. **No network for user data.** No `fetch`, no `/api`, no server actions, no analytics. Parsers load their worker from the bundled copy via `new URL(..., import.meta.url)`.
2. **No `console.*` in `src/`** except the single guarded `[unknown-error]` log in `lib/utils/errors.ts`. Never log resume text, filenames containing PII, or file contents.
3. **Never let raw PII reach the UI.** `contact-detector.ts` returns booleans and counts only. Redaction (`redact.ts`) runs **on the way out** — redacting before scoring would make a present email look missing. Do not "clean up" this ordering.
4. **Scoring must stay deterministic.** No `Math.random`, no `Date.now()`, no network, no model calls inside `lib/resume/**` or `config/scoring.ts`. Same input + same `SCORING_VERSION` ⇒ byte-identical report.
5. **No `innerHTML` / `dangerouslySetInnerHTML` anywhere.** `marked-up-bullets.tsx` builds text from sliced strings.
6. **No OCR, no image text extraction.** Image-only pages are detected and reported, never guessed.
7. **No comments explaining *what* code does.** Comments in this repo explain *why a design decision was made* and what was rejected. Match that, or write nothing.

---

## 3. Where numbers live

`src/config/scoring.ts` is the single source of truth for weights, thresholds, bands, the version string, and upload limits. `ALL_CHECKS` (`lib/resume/rules/index.ts`) is the source of truth for the check list.

Any page that displays a number must read it from config or `ALL_CHECKS` — `/how-scoring-works`, `/how-it-works`, `/what-we-check`, `/faq`, `hero-section`, `cta-section`, `report-summary`, and `opengraph-image.tsx` all already do this.

**Do not introduce a hardcoded literal for: check count, category count, category weight, threshold, band threshold, upload limit, or `SCORING_VERSION`.**

Known drift to be aware of (do not "fix" silently — confirm with the user first):
- `opengraph-image.tsx` says "31 published checks"; the real count is 30.
- `AUDIT.md` and `csp-verify.log` are stale historical artifacts.

---

## 4. Conventions

**Imports**
- `@/*` → `./src/*` (mirrored in `vitest.config.ts`).
- Sibling imports inside a folder: relative (`./helpers`). Cross-folder: `@/`.
- Type-only imports must use `import type { ... }`.

**Naming**
- Files: `kebab-case.tsx` / `kebab-case.ts`.
- Components, functions, types: `PascalCase`.
- Constants: `SCREAMING_SNAKE_CASE` (including file-local ones like `MAX_SIZE_LABEL`, `MARK_ORDER`).
- Union members: lowercase-kebab string literals (`"not-applicable"`, `"unable-to-verify"`, `"no-text-extracted"`).

**Client vs server**
- Default to server components. Only add `"use client"` when the file genuinely needs state, effects, refs, or browser APIs — and it must be the first statement.
- Known client boundary: `check/check-client.tsx`, `resume/*`, `theme/*`, `ui/{dialog,tooltip,progress,accordion}.tsx`, `layout/mobile-nav.tsx`, `report/{detailed-checks,marked-up-bullets,priority-fixes,report-actions}.tsx`.
- `report/report-view.tsx` and the other report presentational components have **no** directive but use hooks — they inherit the client boundary from `CheckClient`. Keep it that way.

**TypeScript**
- `strict`, `noUncheckedIndexedAccess`, `isolatedModules`, `noEmit`. Array access after a length check uses `!` or an explicit fallback — keep doing that.
- No `any`. No non-null assertions except after a real guard.

**Styling**
- Tailwind v4, config inside `globals.css` via `@theme`. No `tailwind.config.js`. No CSS modules, no styled-components.
- Merge classes with `cn()` from `@/lib/utils/cn`.
- Never hardcode hex outside `globals.css` and `opengraph-image.tsx` (Satori needs literals).
- `globals.css` uses plain `@theme`, **not** `@theme inline` — inline bakes light values in and breaks the theme toggle.
- Optional props resolve as `const x = tone ?? "mute"`, not destructure defaults.

**Colour**
`src/components/ui/tones.ts` is the **only** domain→tone mapping. Do not introduce colour anywhere else. Rule: colour only when a real result stands behind it; pure measurements stay ink. There is deliberately no "brand" tone.

**State**
No state library. Local `useState`, one context (`ThemeContext`), one `localStorage` key (`resumegauge-theme`). Never persist resume data.

**Errors**
`AppError` with a typed `code` is the single error type. Boundaries return result shapes, not throws:
`{ ok: true, value } | { ok: false, error: AppError }`. `toAppError()` converts at the UI boundary.

**Validation**
`zod` is currently used in exactly one place: `lib/resume/file-validation.ts`. Do not sprinkle it elsewhere without a reason; the rest of the codebase uses plain guards.

**No i18n.** Copy is inline English, deliberately adjacent to the logic that produces it (rule explanations and recommendations live in their rule module).

---

## 5. `src/components/ui` is not shadcn

It is shadcn-*inspired* and hand-rolled: Radix primitives + `cva` + `cn()`, but a completely custom design language ("Proof Sheet" — a page is a sheet of paper on a desk). There is no `components.json`, and no `input`/`label`/`select`/`textarea`/`tabs`. Most components do not use `forwardRef`; only Radix-wrapped ones do, and `forwardRef` (not the React 19 ref-as-prop form) is used throughout. Don't add components by running the shadcn CLI.

---

## 6. Adding or changing a scoring check

1. Define the check in the right `lib/resume/rules/{structure,content,contact,readability,skills}.ts`.
2. Register it in `rules/index.ts` (`ALL_CHECKS`) — this is what every page counts.
3. Ensure `points` per category sum to that category's weight in `config/scoring.ts`. **The total must remain 100.**
4. Put the recommendation copy in the rule, not in the component. Never promise an outcome ("will get you hired", "guarantee", "will reject") — `tests/scoring.test.ts` asserts the absence of exactly these phrases.
5. Use `not-applicable` / `unable-to-verify` with `pointsPossible: 0` when a check genuinely cannot run (e.g. no projects section for a fresher) — these are removed from both totals.
6. Bump `SCORING_VERSION` in `config/scoring.ts` if the change alters scores for any input.
7. Add a fixture to `tests/resume-fixtures.ts` and a case to `tests/scoring.test.ts`.

---

## 7. Tests

Flat `tests/` at repo root, one file per `src/lib/resume/*` module. `*.test.ts` for logic, `*.test.tsx` for components.

- Default environment is `node`; jsdom is opted into per file with a `@vitest-environment jsdom` docblock.
- `globals: false` — always import `describe`/`expect`/`it` from `"vitest"`.
- Component tests use `React.createElement` + `act`, **not JSX** (app tsconfig uses `jsx: "preserve"`), set `IS_REACT_ACT_ENVIRONMENT` manually, and assert via `container.textContent`. No React Testing Library.
- `tests/document-fixtures.ts` builds **real** PDF and DOCX bytes. Prefer that over mocking parsers.
- `tests/resume-fixtures.ts` fixtures are invented; never add real personal data.

---

## 8. Commands

```
npm run dev         # dev server
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run test        # vitest run
npm run build       # next build
npm run verify      # typecheck + lint + test + build
```

**Verification policy:** the maintainer runs `typecheck`, `lint`, `test`, and `build` manually. Do not run these as part of feature work unless explicitly asked — it slows iteration and the feedback is not being used. Write code you believe compiles; do not report a feature as "verified".

Prettier is enforced (`printWidth: 100`, double quotes, semicolons, trailing commas). `format:check` is not part of `verify`.

---

## 9. Env vars

- `NEXT_PUBLIC_SITE_URL` — **required for production builds.** `config/site.ts` throws at module load if `NODE_ENV === "production"` and the URL still contains `example.com`.
- `NEXT_PUBLIC_CONTACT_EMAIL` — falls back to a placeholder.

CI sets both to `ci.local` values to satisfy the guard. Don't remove or weaken that guard.

---

## 10. Gotchas

- `lib/resume/promise-shims.ts` **must** be imported before `pdfjs-dist` (`pdf-parser.ts` line 2 does this). Adding imports above it will break pdf.js on Node 22.
- The pdf.js worker is bundled, and `isEvalSupported: false` — required by the production CSP, which has no `'unsafe-eval'`.
- `next.config.ts` relaxes the CSP only in dev (`unsafe-eval` for React Refresh, `ws:/wss:` for HMR, `upgrade-insecure-requests` prod-only so it can't break `http://localhost`). Don't "clean up" those branches.
- `ui/accordion.tsx` uses native `<details>`, chosen deliberately for pre-hydration correctness and printing. `report-view.tsx` hooks `beforeprint`/`afterprint` to open and restore them.
- `theme-provider.tsx` renders `"system"` on the server and reads the real preference after mount — the blocking `<head>` script in `layout.tsx` already applied the class. Do not "fix" this to read localStorage during render; it reintroduces the flash.
- `resume-uploader.tsx` keeps the `<input>` `sr-only` and clicks it from a real `<Button>` on purpose. Nesting them broke the click.
