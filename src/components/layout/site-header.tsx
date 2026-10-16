import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: siteConfig.links.howItWorks, label: "How it works" },
  { href: siteConfig.links.whatWeCheck, label: "What we check" },
  { href: siteConfig.links.faq, label: "Questions" },
];

/**
 * The masthead sits on the desk rather than on the paper, so the sheet below it
 * always reads as a page. Navigation is plain inline links — a printed contents
 * line, not a floating pill.
 */
export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-edge bg-background/92 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Brand />

        <nav aria-label="Main navigation" className="hidden items-center gap-5 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[14px] font-medium text-ink-2 transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={siteConfig.links.howScoringWorks}
            className="text-[14px] font-medium text-ink-2 transition-colors hover:text-ink"
          >
            Scoring
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-[12px] font-medium text-ink-3 lg:flex">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-pass" />
            Read on your device
          </span>
          <ThemeToggle className="hidden sm:flex" />
          <Button asChild size="sm">
            <Link href={siteConfig.links.check}>Check my resume</Link>
          </Button>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}