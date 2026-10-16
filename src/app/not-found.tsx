import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export default function NotFound() {
  return (
    <PageContainer size="prose" className="py-16 sm:py-24">
      <div className="flex flex-col items-start gap-5">
        <p className="figure text-ink-3">Error 404</p>
        <h1 className="max-w-[18ch] text-[2.25rem] leading-[1.03] tracking-[-0.032em] text-ink sm:text-[2.875rem]">
          This page is not here.
        </h1>
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