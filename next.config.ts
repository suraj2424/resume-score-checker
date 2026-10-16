import type { NextConfig } from "next";

/**
 * Security headers for a client-only app handling user documents.
 *
 * Production is strict: no `unsafe-eval` anywhere (pdf.js runs with
 * `isEvalSupported: false`), no remote scripts.
 *
 * Development relaxes two directives, and only in development:
 * - `script-src 'unsafe-eval'` — required by Next.js dev (React Refresh /
 *   eval source maps). Without it the dev page renders but no button works.
 * - `connect-src ws: wss:` — the dev HMR websocket. Without it hot reload
 *   cannot connect.
 * `upgrade-insecure-requests` is also production-only so it can never break
 * the local `http://localhost` dev server (it would upgrade ws:// to wss://).
 */
const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
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
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
