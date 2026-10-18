import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";
import { PageContainer } from "./page-container";
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
 *
 * `PageContainer` owns the gutters for the whole site. This row used to spell
 * its own `max-w-[1120px]` with `px-4 sm:px-6 lg:px-8`, which put the logo and
 * the first line of page content out by 4px/8px/8px at every breakpoint below
 * `lg` — the footer agreed with the page and the masthead disagreed with both.
 *
 * What is hidden and where is a width budget, not a preference. At 320px the
 * brand, the nav, the theme control and the call to action do not fit: the nav
 * appears at `lg` and the sheet stays open to `lg` so navigation is never absent
 * from the row; the call to action moves into that sheet below `sm`, where it is
 * one tap away; and the "reads on your device" claim waits for `xl`. Dropping any
 * one of those to save 320px would put the page back into horizontal scroll.
 */
export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-edge bg-background/92 backdrop-blur-sm">
      <PageContainer size="wide" className="flex h-16 items-center gap-4 sm:gap-6">
        <Brand className="shrink-0" />

        <nav aria-label="Main navigation" className="hidden items-center gap-5 lg:flex">
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
          <span className="hidden items-center gap-1.5 text-[13px] font-medium text-ink-3 xl:flex">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-pass" />
            Read on your device
          </span>
          <ThemeToggle className="hidden sm:flex" />
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href={siteConfig.links.check}>Check my resume</Link>
          </Button>
          <MobileNav />
        </div>
      </PageContainer>
    </header>
  );
}