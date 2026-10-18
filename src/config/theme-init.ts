/**
 * The blocking theme script, as the exact text that is hashed.
 *
 * It lives here, and not inline in `layout.tsx`, because the CSP has to name a
 * hash of these exact bytes. Two copies of this string would drift and the
 * script would stop running under `script-src` with no error anywhere — the page
 * would just flash light before hydrating. `next.config.ts` hashes this export,
 * so there is one source of truth for the text and one for the policy.
 *
 * It stays inline and blocking on purpose: reading `localStorage` after mount
 * is the flash this script exists to prevent (AGENTS.md §10).
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("resumegauge-theme");
    var preference = stored === "light" || stored === "dark" ? stored : "system";
    var isDark =
      preference === "dark" ||
      (preference === "system" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  } catch (error) {
  }
})();
`;
