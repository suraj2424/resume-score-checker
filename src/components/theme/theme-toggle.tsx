"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "./theme-provider";
import { cn } from "@/lib/utils/cn";

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * Three-state theme selector: Light, Dark and System.
 *
 * Built as a segmented control rather than a row of buttons in a padded box.
 * A lone filled button beside bare icons reads as a different size, because the
 * eye compares the filled area to the icon area instead of comparing slots. Hair
 * line dividers make the three segments explicit and equally padded, and the
 * selected segment still uses solid ink — the same "ink means active" language
 * as every other control here.
 *
 * Each option is a real toggle button with an accessible name and pressed
 * state, so it works with screen readers, keyboards and touch.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="group"
      aria-label="Color theme"
      className={cn(
        "inline-flex items-stretch border border-rule bg-sheet-tint",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={`${option.label} theme`}
            onClick={() => setPreference(option.value)}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center border-r border-rule transition-colors",
              "last:border-r-0",
              active
                ? "bg-ink text-sheet"
                : "text-ink-3 hover:bg-sheet hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="sr-only">{option.label} theme</span>
          </button>
        );
      })}
    </div>
  );
}