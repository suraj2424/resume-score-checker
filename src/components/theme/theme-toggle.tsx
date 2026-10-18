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
 * state, so it works with screen readers, keyboards and touch. The name comes
 * from the `sr-only` text alone: a `title` alongside it announced the label
 * twice and added the one hover tooltip this design language otherwise has no
 * use for.
 *
 * Below `sm` the masthead hides this control (`hidden sm:flex`) and the same
 * control appears inside the menu sheet, so a phone takes two steps to reach a
 * three-option choice. That is a deliberate trade: the masthead row has no width
 * at 320px for a 108px control, and a full-width control in the header would
 * either overflow the page or push the primary action off screen.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="group"
      aria-label="Color theme"
      data-slot="theme-toggle"
      className={cn(
        "inline-flex items-stretch rounded-[3px] border border-rule bg-sheet-tint",
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
            onClick={() => setPreference(option.value)}
            /*
              The selected segment is filled with ink, and `--color-focus-ring`
              is that same ink in light mode, so a focus ring in the ring colour
              would vanish into the segment it is drawn on. The selected segment
              rings in `--color-sheet` instead — the paper colour, which is the
              inverse of the segment in both themes. Inset rather than offset so
              the indicator never depends on what happens to sit behind the
              control.
            */
            className={cn(
              "flex size-9 shrink-0 items-center justify-center border-r border-rule transition-colors last:border-r-0",
              "focus-visible:ring-2 focus-visible:ring-inset",
              active
                ? "bg-ink text-sheet focus-visible:ring-sheet"
                : "text-ink-3 hover:bg-rule hover:text-ink focus-visible:ring-focus-ring",
              "sm:size-8",
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