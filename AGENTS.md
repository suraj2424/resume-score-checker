# AGENTS.md

Guidance for AI agents working in this repo. Read this before editing anything.

`README.md` already documents the product, architecture, scoring methodology, theme system, privacy model, and deployment. **Read it rather than duplicating it here.** This file covers only the conventions and constraints that are easy to violate.

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
  → scoreResume             (36 pure rules)
  → ScoreReport
  → redactContact           (display boundary only)
```

---

## 2. Hard constraints

Violating any of these breaks the product promise, not just the code. Constraints 1, 2, 4 and 5 are now machine-enforced in `eslint.config.mjs` — a violation fails `npm run lint`. Constraints 3, 6 and 7 are not lintable and rest on review.

1. **No network for user data.** No `fetch`, no `/api`, no server actions, no analytics. Parsers load their worker from the bundled copy via `new URL(..., import.meta.url)`.
2. **No `console.*` in `src/`** except the single guarded `[unknown-error]` log in `lib/utils/errors.ts`. Never log resume text, filenames containing PII, or file contents.
3. **Never let raw PII reach the UI.** `contact-detector.ts` returns booleans and counts only. Redaction (`redact.ts`) runs **on the way out** — redacting before scoring would make a present email look missing. Do not "clean up" this ordering.
4. **Scoring must stay deterministic.** No `Math.random`, no `Date.now()`, no network, no model calls inside `lib/resume/**` or `config/scoring.ts`. Same input + same `SCORING_VERSION` ⇒ byte-identical report.
5. **No `innerHTML` / `dangerouslySetInnerHTML` anywhere** — with exactly one carve-out, and it is not negotiable twice.
   - `marked-up-bullets.tsx` builds text from sliced strings.
   - **The carve-out:** `app/layout.tsx` inlines the blocking theme script as `dangerouslySetInnerHTML`. It must be inline and blocking to beat the first paint (§10), and it is the single exception `eslint.config.mjs` allows for that one file.
   - **Why it is safe, and what breaks it:** `next.config.ts` computes the sha256 of `THEME_INIT_SCRIPT` and puts it in `script-src` instead of allowing `'unsafe-inline'`. That hash is the entire safety argument. Under `'unsafe-inline'` any injected `<script>` would run, which on a page whose pitch is "your file never leaves the tab" is the primary thing a CSP exists to prevent. So: a second inline script will not execute, and editing the script without it being the same string the hash is computed from will break the theme silently. `'unsafe-hashes'` is deliberately **not** used — it would hand back exactly the attribute-injection surface the hash removes.
   - The script itself lives in `config/theme-init.ts` precisely so there is one copy to hash.
6. **No OCR, no image text extraction.** Image-only pages are detected and reported, never guessed.
7. **No comments explaining *what* code does.** Comments in this repo explain *why a design decision was made* and what was rejected. Match that, or write nothing.

---

## 3. Where numbers live

`src/config/scoring.ts` is the single source of truth for weights, thresholds, bands, the version string, and upload limits. `ALL_CHECKS` (`lib/resume/rules/index.ts`) is the source of truth for the check list.

Any page that displays a number must read it from config or `ALL_CHECKS` — `/how-scoring-works`, `/how-it-works`, `/what-we-check`, `/faq`, `hero-section`, `cta-section`, `report-summary`, and `opengraph-image.tsx` all already do this.

**Do not introduce a hardcoded literal for: check count, category count, category weight, threshold, band threshold, upload limit, or `SCORING_VERSION`.**

Known drift to be aware of (do not "fix" silently — confirm with the user first):

- **`src/app/opengraph-image.tsx` hand-writes the check count.** `PUBLISHED_CHECK_COUNT` is 36 and matches `ALL_CHECKS.length` today, but Satori cannot read `ALL_CHECKS`. It has already drifted once (the card said 31 while the engine ran 30), so a future test asserting the sync is worth more than the constant is.
- **`src/components/landing/hero-section.tsx` hardcodes the words "five bands"** while reading `TOTAL_SCORE_WEIGHT` from config two lines above it. `SCORE_BANDS` lives in `config/scoring.ts`, so the count belongs there too.
- `@typescript-eslint/*` and `eslint-plugin-import` are used directly by `eslint.config.mjs` but are only present as `eslint-config-next`'s transitive dependencies. Declaring them in `devDependencies` also requires regenerating `package-lock.json`, which is why it has not been done.
- `AUDIT.md` is a stale historical artifact: it describes the tree at commit `418b533`, before the fixes it recommends were applied. Nothing in it is deferred work.

---

## 4. Conventions

**Imports**
- `@/*` → `./src/*` (declared in `tsconfig.json` and `next.config.ts`). Cross-folder imports go through the alias; ESLint rejects a relative path that climbs three levels.
- Sibling imports inside a folder: relative (`./helpers`). Cross-folder: `@/`.
- Type-only imports must use `import type { ... }` — or an inline `type` specifier in a mixed import. `verbatimModuleSyntax` now fails the build if you forget, so this is no longer a convention.

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
- Also on: `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. The first four close silent-fallthrough and dead-code holes; `verbatimModuleSyntax` enforces the import rule above.
- **Deferred on purpose: `exactOptionalPropertyTypes`.** It is not that the flag is wrong, it is that the model predates it. `ParsedResume` copies `pageCount: source.pageCount` where `SourceDocument.pageCount` is `pageCount?: number`, and the same shape recurs through `structure?: DocumentStructure`, `confidence?: Confidence` and `ResumeSection.order`. Every one of those becomes an error, and fixing them means either widening the model to `pageCount: number | undefined` (a public type change) or threading explicit `undefined` through every construction site. Both are `src/` changes, so the flag stays off until the model is reworked deliberately.
- **Rejected: `noUncheckedSideEffectImports`.** It was on trial as a way to catch a renamed `promise-shims.ts`. Two reasons it is not in `tsconfig.json`: it does **not** enforce the *ordering* that §10 actually needs, and it breaks the build. Next.js 15 ships ambient declarations for `*.module.css` but not plain `*.css`, so `import "./globals.css"` in `app/layout.tsx` has no type to resolve and becomes TS2307. Making it work needs a `declare module "*.css"` in `src/` — a change this file does not own — for no benefit the flag did not already fail to deliver.
- **`allowJs: true` is still set** even though `include` globs only `**/*.ts` / `**/*.tsx`. Nothing in the repo depends on it today; it is left alone rather than removed so that a future JS import inside `src/` does not become a surprise, but do not add JS to `src/`.
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

`zod` is currently used in exactly one place: `lib/resume/file-validation.ts`. Do not sprinkle it elsewhere without a reason; the rest of the codebase uses plain guards. That module is imported dynamically from `analyze-file.ts`, which is what keeps a 5.9 MB on-disk dependency out of the eagerly-loaded graph — a static import there silently puts it back.

**No i18n.** Copy is inline English, deliberately adjacent to the logic that produces it (rule explanations and recommendations live in their rule module).

---

## 5. `src/components/ui` is not shadcn

It is shadcn-*inspired* and hand-rolled: Radix primitives + `cva` + `cn()`, but a completely custom design language ("Proof Sheet" — a page is a sheet of paper on a desk). There is no `components.json`, and no `input`/`label`/`select`/`textarea`/`tabs`. Most components do not use `forwardRef`; only Radix-wrapped ones do, and `forwardRef` (not the React 19 ref-as-prop form) is used throughout. Don't add components by running the shadcn CLI.

---

## 6. Adding or changing a scoring check

1. Define the check in the right `lib/resume/rules/{structure,content,contact,readability,skills}.ts`.
2. Register it in `rules/index.ts` (`ALL_CHECKS`) — this is what every page counts.
3. Ensure `points` per category sum to that category's weight in `config/scoring.ts`. **The total must remain 100.**
4. Put the recommendation copy in the rule, not in the component. Never promise an outcome ("will get you hired", "guarantee", "will reject").
5. Use `not-applicable` / `unable-to-verify` with `pointsPossible: 0` when a check genuinely cannot run (e.g. no projects section for a fresher) — these are removed from both totals.
6. Bump `SCORING_VERSION` in `config/scoring.ts` if the change alters scores for any input.
7. When the test suite exists, add a fixture to `tests/resume-fixtures.ts` and a case to `tests/scoring.test.ts`.

---

## 7. Commands

```
npm run dev         # dev server
npm run typecheck   # tsc --noEmit
npm run lint        # eslint . --max-warnings 0
npm run build       # next build
npm run verify      # typecheck + lint + build
```

`lint` runs with `--max-warnings 0` on purpose. `eslint-config-next` downgrades `no-unused-vars` and `no-unused-expressions` to *warnings*, and without the flag, unused code passes CI silently — which is how a couple of dozen dead exports accumulated. If lint fails on a warning you cannot justify, fix the code or downgrade that one rule explicitly; do not drop the flag.

**Verification policy:** the maintainer runs `typecheck`, `lint`, and `build` manually. Do not run these as part of feature work unless explicitly asked — it slows iteration and the feedback is not being used. Write code you believe compiles; do not report a feature as "verified".

Prettier uses `printWidth: 120`, double quotes, semicolons, trailing commas. That width is a correction, not a preference: the old value of 100 disagreed with how the code was written and failed on 85 files that nobody had reformatted. **The repo is not reformatted**, so `format:check` fails, which is why it is neither in `verify` nor blocking in CI — it runs there with `continue-on-error`. The full rationale, including why it lives in `.prettierignore` (prettier's JSON parser rejects comments in `.prettierrc.json`), is at the bottom of that file.

`.github/workflows/ci.yml` runs four jobs in parallel: `quality` (typecheck + lint + advisory format), `build` (production build, a 1.5 MB budget on the emitted pdf.js worker, and a runtime smoke test of the served routes and headers), and an advisory `npm audit`. Actions are pinned to commit SHAs, which is why `.github/dependabot.yml` has a `github-actions` entry — nothing else can move those pins.

---

## 9. Env vars

- `NEXT_PUBLIC_SITE_URL` — **required for production builds.** `config/site.ts` throws at module load if `NODE_ENV === "production"` and the URL still contains `example.com`.
- `NEXT_PUBLIC_CONTACT_EMAIL` — falls back to a placeholder.

CI sets both to `ci.local` values to satisfy the guard. Don't remove or weaken that guard.

---

## 10. Gotchas

- `lib/resume/promise-shims.ts` **must** be imported before `pdfjs-dist` (`pdf-parser.ts` line 2 does this). Adding imports above it will break pdf.js on Node 22. No compiler flag enforces this — `noUncheckedSideEffectImports` would only have caught a *renamed* shim, not a *reordered* one, and it was rejected anyway (§4). CI covers the code path indirectly by running the suite on Node 20, 22 and 24 — Node 24 makes `Promise.try` native, so the shim takes its no-op branch there and the polyfill branch on the others.
- The pdf.js worker is bundled, and `isEvalSupported: false` — required by the production CSP, which has no `'unsafe-eval'`. It is 1,232,303 bytes; CI fails the build above 1.5 MB.
- `next.config.ts` relaxes the CSP only in dev (`unsafe-eval` for React Refresh, `ws:/wss:` for HMR, `upgrade-insecure-requests` prod-only so it can't break `http://localhost`). Don't "clean up" those branches.
- `ui/accordion.tsx` uses native `<details>`, chosen deliberately for pre-hydration correctness and printing. `report-view.tsx` hooks `beforeprint`/`afterprint` to open and restore them.
- `theme-provider.tsx` renders `"system"` on the server and reads the real preference after mount — the blocking `<head>` script in `layout.tsx` already applied the class. Do not "fix" this to read localStorage during render; it reintroduces the flash.
- `resume-uploader.tsx` keeps the `<input>` `sr-only` and clicks it from a real `<Button>` on purpose. Nesting them broke the click.
