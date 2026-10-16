import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * The page has no box. Content sits directly on the desk and the header flows
 * straight into the hero, with sections separated by hairlines rather than by
 * nested surfaces. This container owns the single horizontal gutter for the
 * whole site so every page lines up with the masthead and the footer.
 *
 * `prose` is the reading measure for the long-form pages, keeping body copy
 * under 70 characters per line. `wide` is the working measure for the landing
 * page and the report.
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