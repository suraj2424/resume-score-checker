"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils/cn";

const NAV_LINKS = [
  { href: siteConfig.links.howItWorks, label: "How it works" },
  { href: siteConfig.links.whatWeCheck, label: "What we check" },
  { href: siteConfig.links.howScoringWorks, label: "How scoring works" },
  { href: siteConfig.links.faq, label: "Questions" },
];

/** Compact menu for small screens: navigation, theme, and the primary action. */
export function MobileNav({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-[3px] border border-rule-2 bg-sheet text-ink transition-colors hover:bg-sheet-tint lg:hidden",
          className,
        )}
        aria-label="Open menu"
      >
        <Menu className="size-4" aria-hidden="true" />
      </DialogTrigger>
      <DialogContent
        className="sheet bottom-4 top-auto max-w-sm translate-x-[-50%] translate-y-0 p-0"
        hideClose
      >
        {/*
          `hideClose` suppresses the corner X, so the sheet needs a close
          affordance of its own. It had none: dismissal relied on Escape,
          overlay-tap or tapping a link, none of which is discoverable on touch.
          The dialog is controlled, so a plain button that clears `open` is the
          whole close path — the primitive is not needed for it.
        */}
        <div className="flex items-center justify-between gap-3 border-b border-rule px-3 py-2.5">
          <DialogTitle className="text-[13px] text-ink-3">Menu</DialogTitle>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-[3px] text-ink-3 transition-colors hover:bg-rule hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Close menu</span>
          </button>
        </div>

        <nav aria-label="Mobile navigation" className="flex flex-col p-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="border-b border-rule px-3 py-3 text-[15px] font-medium text-ink transition-colors last:border-b-0 hover:bg-sheet-tint"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-3 border-t border-rule p-2">
          <ThemeToggle />
          <Button asChild size="sm" onClick={() => setOpen(false)}>
            <Link href={siteConfig.links.check}>Check my resume</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}