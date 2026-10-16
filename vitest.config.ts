import { defineConfig } from "vitest/config";
import path from "node:path";

const config = {
  /**
   * The app tsconfig uses `jsx: "preserve"` for Next.js, so tests transform
   * JSX through the active transformer instead. The `oxc` runtime option is
   * not yet covered by the bundled Vite/Vitest type definitions, hence the
   * structural assertion.
   */
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
} as Parameters<typeof defineConfig>[0];

export default defineConfig(config);
