import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader, ProseBullet } from "@/components/layout/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch about ResumeGauge: report a problem with a document type, ask about the scoring methodology, or request a feature.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <PageContainer size="prose" className="py-10 sm:py-14">
      <div className="flex flex-col gap-12">
        <PageHeader
          label="Contact"
          title="Get in touch"
          standfirst={
            <>
              Email is the fastest way to reach us. Please do not attach your resume — describe the
              problem instead, because files sent by email are stored on mail servers and we cannot
              analyze them for you.
            </>
          }
        />

        <section className="flex flex-col border-t border-rule">
          <div className="grid gap-3 border-b border-rule py-6 sm:grid-cols-[10rem_1fr] sm:gap-6">
            <p className="label pt-0.5">Email</p>
            <div className="flex flex-col gap-2">
              <p className="max-w-[58ch] text-[15px] leading-relaxed text-ink-2">
                Questions about the tool, the scoring methodology, or partnership requests.
              </p>
              <a href={`mailto:${siteConfig.contactEmail}`} className="link w-fit text-[15px]">
                {siteConfig.contactEmail}
              </a>
            </div>
          </div>

          <div className="grid gap-3 border-b border-rule py-6 sm:grid-cols-[10rem_1fr] sm:gap-6">
            <p className="label pt-0.5">Parsing problems</p>
            <div className="flex flex-col gap-2">
              <p className="max-w-[58ch] text-[15px] leading-relaxed text-ink-2">
                If a valid PDF or DOCX fails to parse, tell us which application exported it and
                what happened. Do not include the file or any personal detail from it — a description
                of the export settings is enough for us to reproduce the problem.
              </p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading title="Before you write" />
          <ul className="flex flex-col gap-2.5">
            <ProseBullet>
              For methodology questions, the{" "}
              <Link href={siteConfig.links.howScoringWorks} className="link">
                scoring page
              </Link>{" "}
              documents every check and every weight.
            </ProseBullet>
            <ProseBullet>
              For upload errors, the{" "}
              <Link href={siteConfig.links.faq} className="link">
                questions page
              </Link>{" "}
              covers scanned PDFs, size limits and unsupported formats.
            </ProseBullet>
            <ProseBullet>
              We cannot recover a report for you. Reports are never stored, not even on our side.
            </ProseBullet>
          </ul>
        </section>
      </div>
    </PageContainer>
  );
}