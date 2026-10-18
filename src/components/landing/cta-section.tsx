import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { SCORING_VERSION } from "@/config/scoring";
import { ALL_CHECKS } from "@/lib/resume/rules";

export function CtaSection() {
  return (
    <section className="border-t border-edge py-14 lg:py-20">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-14">
        <div className="flex flex-col gap-3">
          {/* The base `h2` rule in `globals.css` is authoritative now. This
              override was the third h2 size on the site and the only one that
              disagreed with `SectionHeading`; two heading sizes is the scale. */}
          <h2 className="max-w-[20ch] text-ink">Know what a recruiter sees first.</h2>
          <p className="max-w-[58ch] text-[15px] leading-relaxed text-ink-2">
            {ALL_CHECKS.length} checks, {SCORING_VERSION}, no sign-up. Open the report, fix the
            first red item, then decide whether you want the rest.
          </p>
        </div>
        <div className="flex flex-col items-start gap-4 lg:items-end">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={siteConfig.links.check}>Check my resume</Link>
          </Button>
          <Link href={siteConfig.links.howScoringWorks} className="link text-[14px] font-medium">
            Read the weighting first
          </Link>
        </div>
      </div>
    </section>
  );
}