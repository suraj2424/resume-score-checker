import Link from "next/link";
import { BandLadder } from "@/components/landing/band-ladder";
import { ProofExcerpt } from "@/components/landing/proof-excerpt";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { SCORING_CATEGORIES, SCORING_VERSION, SCORE_BANDS, TOTAL_SCORE_WEIGHT } from "@/config/scoring";
import { ALL_CHECKS } from "@/lib/resume/rules";
import { formatFileSize } from "@/lib/utils/format";
import { MAX_UPLOAD_BYTES } from "@/config/scoring";

const PROOF = [
  { value: ALL_CHECKS.length, unit: "checks", note: "published in full" },
  { value: SCORING_CATEGORIES.length, unit: "categories", note: "weights fixed" },
  { value: 0, unit: "uploads", note: "runs on your device" },
] as const;

export function HeroSection() {
  return (
    <>
      <section className="pb-14 pt-10 sm:pb-16 sm:pt-12 lg:pb-20 lg:pt-14">
        <div className="grid items-start gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch lg:gap-14">
          <div className="animate-rise flex min-w-0 flex-col gap-7">
            <p className="label">Resume review, deterministic</p>

            {/* `text-display` is the only sanctioned second h1 size and the
                hero is its only call site. The arbitrary `sm:`/`lg:` values
                this replaces overrode the base `h1` rule in `globals.css`, so
                the scale's own size, line-height and tracking were dead here
                and four different h1 sizes shipped across the site. */}
            <h1 className="max-w-[36ch] text-display text-ink">
              Your resume, marked up before you send it.
            </h1>

            <p className="max-w-[58ch] text-[17px] leading-relaxed text-ink-2">
              {siteConfig.name} runs {ALL_CHECKS.length} fixed checks across{" "}
              {SCORING_CATEGORIES.length} weighted categories, then lists what to fix first — with
              the evidence behind every point. Parsing and scoring happen in this tab.
            </p>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
              <Button asChild size="lg">
                <Link href={siteConfig.links.check}>Check my resume</Link>
              </Button>
              <Link href={siteConfig.links.howItWorks} className="link text-[15px] font-medium">
                See how a check runs
              </Link>
            </div>

            {/* A ledger, not a dot-joined string: three ruled figures.
                Stacked below `sm`: at 320px a three-column ledger gives each
                figure 80px, the 28px mono value wraps, and the notes run to
                four lines — the numbers stop being scannable. */}
            <dl className="mt-auto grid grid-cols-1 gap-3 border-t border-edge pt-4 sm:grid-cols-3 sm:gap-px">
              {PROOF.map((item) => (
                <div key={item.unit} className="flex min-w-0 flex-col gap-1 sm:pr-4">
                  {/* The unit is the term and the figure is its value, so both
                      belong in the term. The `sr-only` unit this replaced read
                      the pair twice: "uploads, 0, uploads". */}
                  <dt className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="figure-lg text-[1.75rem] leading-none text-ink">
                      {item.value}
                    </span>
                    <span className="text-[13px] font-semibold text-ink-2">{item.unit}</span>
                  </dt>
                  <dd className="text-[13px] leading-snug text-ink-3">{item.note}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="animate-rise rise-2 flex min-w-0 flex-col gap-3">
            <ProofExcerpt />
            <p className="figure text-ink-3">
              PDF or DOCX up to {formatFileSize(MAX_UPLOAD_BYTES)} — scoring version{" "}
              {SCORING_VERSION}
            </p>
          </div>
        </div>
      </section>

      {/* The one memorable element: the scale the score is read against. */}
      <section className="grid gap-8 border-t border-edge py-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:py-20">
        <div className="flex flex-col gap-4">
          <p className="text-[15px] font-semibold tracking-[-0.014em] text-ink">
            {TOTAL_SCORE_WEIGHT} points, {SCORE_BANDS.length} bands, no hidden weighting.
          </p>
          <p className="max-w-[58ch] text-[15px] leading-relaxed text-ink-2">
            Every check carries a fixed point value and every category adds up to its published
            weight. If a check cannot be evaluated, its points come out of the total rather than
            counting against you.
          </p>
        </div>
        <BandLadder />
      </section>
    </>
  );
}