import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader, ProseBullet } from "@/components/layout/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { Alert } from "@/components/ui/alert";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms that apply when using ResumeGauge's free resume score checker, including what the score means and what it does not guarantee.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PageContainer size="prose" className="py-10 sm:py-14">
      <div className="flex flex-col gap-12">
        <PageHeader
          label="Legal"
          title="Terms of use"
          standfirst={
            <>
              {siteConfig.name} scores a resume against its own published checklist. The score is
              guidance for improving your document — not a hiring prediction.
            </>
          }
          meta="Last updated October 2026"
        />

        <Alert tone="note" surface="wash">
          <p className="font-semibold text-ink">Plain-language summary</p>
          <p className="mt-1.5">
            This is a free tool that scores your resume against a fixed list of checks we publish. It
            is not an applicant tracking system, and it does not guarantee that any platform will
            parse your file successfully.
          </p>
        </Alert>

        <section className="flex flex-col gap-4">
          <SectionHeading title="Using the tool" />
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            You may use {siteConfig.name} to check resumes you have the right to use, including your
            own. The service is provided as-is and free of charge. Because processing happens in your
            browser, availability depends on your device rather than on our servers.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading title="What the score means" />
          <ul className="flex flex-col gap-2.5">
            <ProseBullet>
              The score comes from a published checklist of deterministic rules. It measures
              document structure, content signals, contact completeness, readability and general
              skills signals.
            </ProseBullet>
            <ProseBullet>
              It is not a prediction of interview or hiring outcomes, and it is not a guarantee of
              compatibility with any specific applicant tracking system.
            </ProseBullet>
            <ProseBullet>
              Recommendations describe changes you could make to your own document. The tool never
              rewrites your resume and never invents achievements, metrics or experience.
            </ProseBullet>
            <ProseBullet>
              Scores may change between scoring versions as the checklist improves. The version used
              is always shown with your report.
            </ProseBullet>
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading title="Your content and your responsibility" />
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            You keep all rights to the resumes you upload. Because files are processed in your browser
            and never transmitted to us, we cannot review, store or delete them — that control stays
            entirely with you. You are responsible for the accuracy of what you write in your resume.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading title="Acceptable use" />
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            Do not attempt to disrupt the service, reverse engineer the scoring rules for deceptive
            purposes, or upload content you are not permitted to use. Automated access to the public
            pages is subject to the limits described in the site&rsquo;s robots configuration.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading title="Limitation of liability" />
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            To the maximum extent permitted by law, {siteConfig.name} and its authors are not liable
            for any hiring, career or business outcomes influenced by use of the tool. The tool
            provides information; decisions about your applications remain yours.
          </p>
        </section>

        <section className="flex flex-col gap-4 border-t border-rule pt-8">
          <SectionHeading title="Contact" />
          <p className="text-[15px] leading-relaxed text-ink-2">
            Questions about these terms can be sent to{" "}
            <a href={`mailto:${siteConfig.contactEmail}`} className="link">
              {siteConfig.contactEmail}
            </a>
            .
          </p>
        </section>
      </div>
    </PageContainer>
  );
}