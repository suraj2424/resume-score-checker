import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * The page has no box. Content sits directly on the desk and the header flows
 * straight into the hero, with sections separated by hairlines rather than by
 * nested surfaces. This container owns the single horizontal gutter for the
 * whole site so every page lines up with the masthead and the footer.
 *
 * The masthead used to reimplement this as `max-w-[1120px]` with `px-4 sm:px-6
 * lg:px-8`, which put the logo out by 4px/8px/8px against the first line of page
 * content at every breakpoint below `lg`. Anything that has to line up with the
 * page has to come through here; there is no second gutter to keep in sync.
 *
 * Two gutter values, and only two: `px-5 sm:px-8` here for the page, and
 * `px-5 sm:px-7` inside a ruled block whose own border would otherwise make a
 * `sm:px-8` interior look flush with the page it sits on.
 *
 * `prose` is the reading measure for the long-form pages. `wide` is the working
 * measure for the landing page, the report and the masthead.
 *
 * `default` (920px) looks unused — the audit called it dead — but it is reached
 * implicitly by `app/error.tsx`, which renders `<PageContainer>` with no `size`.
 * Deleting it needs that file changed to `size="prose"` in the same commit.
 */
export function PageContainer({
  className,
  children,
  size = "default",
}: {
  className?: string;
  children: React.ReactNode;
  size?: "prose" | "default" | "wide";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8 lg:px-10",
        size === "prose" && "max-w-[760px]",
        size === "default" && "max-w-[920px]",
        size === "wide" && "max-w-[1120px]",
        className,
      )}
    >
      {children}
    </div>
  );
}