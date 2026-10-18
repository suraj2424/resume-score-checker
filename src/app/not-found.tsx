import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export default function NotFound() {
  return (
    <PageContainer size="prose" className="py-16 sm:py-24">
      <div className="flex flex-col items-start gap-5">
        <p className="figure text-ink-3">Error 404</p>
        {/* The base `h1` carries the display size now. This used to pin its own
            `2.25rem/2.875rem`, which was the same pair `page-header.tsx` wrote by
            hand — two copies of one size, and the route where they drifted apart. */}
        <h1 className="max-w-[18ch] text-ink">This page is not here.</h1>
        <p className="max-w-[58ch] text-[17px] leading-relaxed text-ink-2">
          The address you followed does not match a page on this site. You can start a resume check,
          or read how the score is calculated.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button asChild>
            <Link href={siteConfig.links.check}>Check my resume</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={siteConfig.links.howScoringWorks}>How scoring works</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}