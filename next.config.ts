import { createHash } from "node:crypto";
import type { NextConfig } from "next";
import { THEME_INIT_SCRIPT } from "./src/config/theme-init";

/**
 * Security headers for a client-only app handling user documents.
 *
 * Production is strict: no `unsafe-eval` anywhere (pdf.js runs with
 * `isEvalSupported: false`), no remote scripts, no remote fonts.
 *
 * `script-src` carries the sha256 of the one inline script the app has — the
 * blocking theme script in `layout.tsx`, which has to run before first paint
 * (AGENTS.md §10). That script is the single carve-out to AGENTS.md §2.5's
 * no-innerHTML rule, and the hash is the whole reason it is safe: with
 * `'unsafe-inline'` a single injected `<script>` tag would execute, which is
 * the primary thing CSP exists to stop on a page whose whole pitch is that
 * your file never leaves the tab. The hash is computed here from the same
 * exported string rather than pasted in, so editing the script cannot silently
 * break the page — and does not need `'unsafe-hashes'`, which would hand back
 * exactly the attribute-based XSS surface the hash removes.
 *
 * Development replaces the hash with plain `unsafe-inline`, and that is not a
 * relaxation of the same policy — it is a different one, because the two cannot
 * coexist. Per the CSP spec (and Chrome/Edge behaviour), `'unsafe-inline'` is
 * IGNORED whenever a hash or nonce is present in the same source list. Dev
 * needs `'unsafe-inline'` for scripts that are not a fixed string — the App
 * Router flight payload inlined as scripts, and the React Refresh preamble —
 * so carrying the hash alongside it pins every one of them, the client never
 * boots, the RSC stream dies with "Connection closed", and the page paints
 * once and then blanks about a second later when the aborted hydration
 * discards the server HTML. Production does not emit those inline scripts and
 * keeps the hash, which is what makes the theme script safe there.
 * - `script-src 'unsafe-eval'` (dev only) — required by Next.js dev (React
 *   Refresh / eval source maps). Without it the dev page renders but no button
 *   works.
 * - `connect-src ws: wss:` (dev only) — the dev HMR websocket. Without it hot
 *   reload cannot connect.
 * `upgrade-insecure-requests` is also production-only so it can never break
 * the local `http://localhost` dev server (it would upgrade ws:// to wss://).
 */
const isDev = process.env.NODE_ENV !== "production";

const themeScriptHash = createHash("sha256").update(THEME_INIT_SCRIPT).digest("base64");

const scriptSrc = isDev
  ? "'self' 'unsafe-inline' 'unsafe-eval'"
  : `'self' 'sha256-${themeScriptHash}'`;

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  // `next/font/google` self-hosts the woff2 files at build time and serves them
  // from `/_next/static`, so there is no runtime request to Google and no reason
  // to name fonts.googleapis.com or fonts.gstatic.com here.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Without HSTS a first-visit MITM can strip every other header on this list
  // before the browser has ever seen an HTTPS response from this origin. Two
  // years, subdomains included, preloaded.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Nothing here is fetched cross-origin, so no other origin has any business
  // reading a response from this one.
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // Every origin on the page is same-origin and there are no third-party
  // requests left to speed up — the prefetch is pure leak surface.
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Legacy IE/Flash cross-domain policy files: none exist, so nothing may use them.
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  // Stops a cross-origin <iframe> or <object> from triggering a download dialog.
  { key: "X-Download-Options", value: "noopen" },
];

const nextConfig: NextConfig = {
  // Discloses "Next.js" and its version on every response, which is free
  // reconnaissance for anything scanning for framework CVEs.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
