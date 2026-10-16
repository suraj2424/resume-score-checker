"use client";

import * as React from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
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
          "inline-flex size-9 items-center justify-center rounded-[3px] border border-rule-2 bg-sheet text-ink transition-colors hover:bg-sheet-tint md:hidden",
          className,
        )}
        aria-label="Open menu"
      >
        <Menu className="size-4" aria-hidden="true" />
      </DialogTrigger>
      <DialogContent className="sheet top-auto bottom-4 max-w-sm translate-x-[-50%] translate-y-0 p-2" hideClose>
        <DialogTitle className="sr-only">Site menu</DialogTitle>
        <nav aria-label="Mobile navigation" className="flex flex-col">
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
        <div className="mt-3 flex items-center justify-between gap-3 px-1 pb-1">
          <ThemeToggle />
          <Button asChild size="sm" onClick={() => setOpen(false)}>
            <Link href={siteConfig.links.check}>Check my resume</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}