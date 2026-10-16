/**
 * Component-level tests for the theme system: the three-state preference
 * (light, dark, system), persistence in localStorage and the class applied to
 * <html>. Render the real `ThemeProvider` and `ThemeToggle` in jsdom.
 *
 * Written with `createElement` because the project's tsconfig uses
 * `jsx: "preserve"` for Next.js.
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { THEME_STORAGE_KEY } from "@/components/theme/theme-provider";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function buttonByLabel(label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find((b) =>
    (b.getAttribute("title") ?? b.textContent ?? "").includes(label),
  );
}

async function renderToggle() {
  await act(async () => {
    root.render(createElement(ThemeProvider, null, createElement(ThemeToggle)));
  });
}

describe("ThemeProvider + ThemeToggle", () => {
  it("applies the dark class and stores the preference when Dark is chosen", async () => {
    await renderToggle();

    await act(async () => {
      buttonByLabel("Dark")?.click();
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("restores a stored dark preference on mount", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    await renderToggle();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes the dark class when Light is chosen after Dark", async () => {
    await renderToggle();

    await act(async () => {
      buttonByLabel("Dark")?.click();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await act(async () => {
      buttonByLabel("Light")?.click();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("defaults to system (no stored preference, light environment)", async () => {
    await renderToggle();
    // jsdom has no prefers-color-scheme: dark, so system resolves to light.
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
