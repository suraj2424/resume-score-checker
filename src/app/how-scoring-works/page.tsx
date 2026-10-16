import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader, ProseBullet } from "@/components/layout/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  SCORING_CATEGORIES,
  SCORING_THRESHOLDS,
  SCORING_VERSION,
  WARNING_CREDIT,
} from "@/config/scoring";
import { ALL_CHECKS } from "@/lib/resume/rules";
import { RELEVANCE_LIMIT_NOTE } from "@/lib/resume/rules/helpers";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "How Scoring Works — Methodology, Categories and Limits",
  description:
    "How ResumeGauge calculates its 0-100 resume score: the five weighted categories, how each check earns points, what happens when a check cannot be verified, and the limits of the method.",
  alternates: { canonical: "/how-scoring-works" },
};

/** A numbered point in the scoring policy. This list really is a sequence. */
function PolicyStep({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <li className="grid gap-2 border-t border-rule py-5 sm:grid-cols-[2.5rem_1fr] sm:gap-5">
      <span className="figure text-ink-3">{String(index).padStart(2, "0")}</span>
      <div className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2 [&_strong]:font-semibold [&_strong]:text-ink">
        {children}
      </div>
    </li>
  );
}

export default function HowScoringWorksPage() {
  const totalChecks = ALL_CHECKS.length;

  return (
    <PageContainer size="prose" className="py-10 sm:py-14">
      <div className="flex flex-col gap-12">
        <PageHeader
          label="Methodology"
          title="How scoring works"
          standfirst={
            <>
              {siteConfig.name} scores your resume out of 100 using {totalChecks} deterministic
              checks in {SCORING_CATEGORIES.length} weighted categories. Every score traces back to
              individual checks, and each check explains what it found and why it matters.
            </>
          }
          meta={`Scoring version ${SCORING_VERSION}`}
        />

        <section className="flex flex-col gap-6">
          <SectionHeading title="The scoring policy" />
          <ol className="flex flex-col">
            <PolicyStep index={1}>
              <strong>Each check has a fixed point value.</strong> Points are distributed so that
              every category awards exactly its configured weight.
            </PolicyStep>
            <PolicyStep index={2}>
              <strong>A pass earns full points.</strong> A warning earns{" "}
              {Math.round(WARNING_CREDIT * 100)}% of the check&rsquo;s points. An issue earns none.
            </PolicyStep>
            <PolicyStep index={3}>
              <strong>Checks that cannot be verified are excluded, not failed.</strong> If the
              parser cannot gather enough evidence — for example, when a document has almost no
              extractable text — the check is marked &ldquo;unable to verify&rdquo; or &ldquo;not
              applicable&rdquo;, and its points are removed from both the earned and the possible
              totals. The report discloses exactly how many checks were evaluated.
            </PolicyStep>
            <PolicyStep index={4}>
              <strong>The score is the share of the points you could be assessed on.</strong> If
              only 92 of 100 points could be evaluated, the score is the earned points divided by
              92, reported out of 100, with the coverage disclosed alongside it.
            </PolicyStep>
            <PolicyStep index={5}>
              <strong>Identical input always produces an identical score.</strong> There is no
              randomness, no model, and no hidden adjustment. The same document and the same
              scoring version always produce the same result.
            </PolicyStep>
          </ol>
        </section>

        <section className="flex flex-col gap-6">
          <SectionHeading title="The five categories" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-[14px]">
              <thead>
                <tr className="border-y border-rule-2 text-left">
                  <th scope="col" className="py-2.5 pr-4 font-semibold text-ink">
                    Category
                  </th>
                  <th scope="col" className="py-2.5 pr-4 font-semibold text-ink">
                    Weight
                  </th>
                  <th scope="col" className="py-2.5 font-semibold text-ink">
                    Checks
                  </th>
                </tr>
              </thead>
              <tbody>
                {SCORING_CATEGORIES.map((category) => (
                  <tr key={category.id} className="border-b border-rule">
                    <td className="py-3.5 pr-4 align-top">
                      <span className="font-medium text-ink">{category.name}</span>
                      <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-3">
                        {category.description}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 align-top">
                      <span className="figure text-ink">{category.weight}</span>
                    </td>
                    <td className="py-3.5 align-top">
                      <span className="figure text-ink">
                        {ALL_CHECKS.filter((check) => check.categoryId === category.id).length}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-3.5 font-semibold text-ink">Total</td>
                  <td className="py-3.5">
                    <span className="figure text-ink">
                      {SCORING_CATEGORIES.reduce((sum, category) => sum + category.weight, 0)}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <span className="figure text-ink">{totalChecks}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="max-w-[66ch] text-[14px] leading-relaxed text-ink-3">
            These weights are product policy, not universal truths about hiring. They are published
            so you can judge for yourself how much each category should matter for your situation.
          </p>
        </section>

        <section className="flex flex-col gap-6">
          <SectionHeading title={`Every check in version ${SCORING_VERSION}`} />
          <div className="flex flex-col">
            {SCORING_CATEGORIES.map((category) => (
              <div key={category.id} className="border-t border-rule py-5">
                <p className="text-[15px] font-semibold text-ink">{category.name}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {ALL_CHECKS.filter((check) => check.categoryId === category.id).map((check) => (
                    <li key={check.id} className="flex flex-wrap items-baseline gap-x-3 text-[14px] leading-relaxed text-ink-2">
                      <span className="text-ink">{check.title}</span>
                      <span className="figure text-ink-3">
                        {check.points} pts, {check.severity} severity
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading title="How the thresholds were chosen" />
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            Thresholds are conservative and documented rather than tuned to produce flattering
            scores. A bullet longer than {SCORING_THRESHOLDS.longBulletWords} words is flagged, at
            least {SCORING_THRESHOLDS.minimumSkillTermCount} distinct recognized skill terms are
            expected before skills count as a strength, and lines over{" "}
            {SCORING_THRESHOLDS.longLineCharacters} characters are treated as a possible layout
            risk. These values trade false alarms for coverage: a warning is a prompt to review
            something, not a verdict.
          </p>
        </section>

        <section id="ats" className="flex scroll-mt-24 flex-col gap-5">
          <SectionHeading
            title="What ATS compatibility actually means"
            description="A short, honest explanation instead of marketing."
          />
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            Applicant tracking systems store and search resumes as text. If a document&rsquo;s text
            cannot be extracted cleanly, or comes out in a strange order, a human may never see the
            content that looked fine on screen. What genuinely helps: real text rather than images,
            standard section headings, one consistent date format, nothing buried in images, and a
            layout that survives being read from top to bottom.
          </p>
          <Alert tone="caution" surface="wash">
            <p className="font-semibold text-ink">What we do not claim</p>
            <p className="mt-1.5">
              {siteConfig.name} is not an ATS and does not simulate one. We cannot confirm that any
              platform will parse your file, and we will never claim that a multi-column resume is
              universally rejected. Where layout looks risky, the report says the content{" "}
              <em>may</em> be read in an unexpected order and asks you to check the extracted text
              yourself.
            </p>
          </Alert>
        </section>

        <section id="freshers" className="flex scroll-mt-24 flex-col gap-5">
          <SectionHeading title="How fresher resumes are treated fairly" />
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            Candidates without a long employment history are not penalized for lacking one. The
            experience check accepts internships, projects, volunteer work and campus leadership as
            evidence of applied work, and it tells you which alternative it used. The projects check
            is marked &ldquo;not applicable&rdquo; — rather than failed — for candidates who already
            have a substantial experience section.
          </p>
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            {RELEVANCE_LIMIT_NOTE} Comparing against a job post is deliberately out of
            scope for this version.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading title="Known limitations" />
          <ul className="flex flex-col gap-2.5">
            <ProseBullet>
              No OCR. Scanned or image-only documents cannot be analyzed; we detect and report
              image-only pages instead of guessing.
            </ProseBullet>
            <ProseBullet>
              DOCX page counts are estimated from word count, because DOCX files do not store page
              breaks.
            </ProseBullet>
            <ProseBullet>
              Skill detection uses a fixed list of common terms. It shows what was recognized, never
              a complete inventory of your abilities.
            </ProseBullet>
            <ProseBullet>
              Bullet analysis recognizes explicit bullet markers. Paragraph-style resumes are
              flagged, not misread.
            </ProseBullet>
            <ProseBullet>
              No job-description comparison and no rewriting of your bullets. The product will never
              invent an achievement on your behalf.
            </ProseBullet>
          </ul>
        </section>

        <div className="flex flex-wrap gap-3 border-t border-rule pt-8">
          <Button asChild>
            <Link href={siteConfig.links.check}>Check my resume</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={siteConfig.links.faq}>Read the questions</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}