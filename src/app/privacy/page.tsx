import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader, ProseBullet } from "@/components/layout/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { Alert } from "@/components/ui/alert";
import { MAX_UPLOAD_BYTES } from "@/config/scoring";
import { siteConfig } from "@/config/site";
import { formatFileSize } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Privacy Policy — How Your Resume Is Handled",
  description:
    "ResumeGauge processes resume files entirely in your browser. Nothing is uploaded, logged, stored or shared. Read exactly what happens to your file and what we do not collect.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PageContainer size="prose" className="py-10 sm:py-14">
      <div className="flex flex-col gap-12">
        <PageHeader
          label="Legal"
          title="Privacy policy"
          standfirst={
            <>
              {siteConfig.name} reads your resume inside your own browser. No copy of your file or
              its text ever reaches us, because there is no upload step.
            </>
          }
          meta="Last updated October 2026"
        />

        <Alert tone="pass" surface="wash">
          <p className="font-semibold text-ink">The short version</p>
          <p className="mt-1.5">
            Your resume file never leaves your device. It is read, parsed and scored inside your
            browser tab. We hold no server-side copy, there is no account, and no analytics receive
            resume content.
          </p>
        </Alert>

        <section className="flex flex-col gap-4">
          <SectionHeading title="What we process, and where" />
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            When you choose a file, your browser loads it into memory in the current tab. Text
            extraction for PDF and DOCX, section detection, scoring and report rendering all run
            locally using open-source libraries. The file and the extracted text are never sent over
            the network.
          </p>
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            The extracted text does sit in your tab&rsquo;s memory while the report is open, because
            that is what lets the check run without a server. Keeping your contact details out of the
            report does not depend on stripping them out first. Contact detection reports only
            whether an email address, a phone number or a profile link was found, and how many of
            them — never the values themselves — so no rule needs the value to decide anything.
            Any text the report does display is passed through a redaction step at the moment it is
            rendered, so an address, number or link that happens to sit inside a quoted bullet is
            replaced with a label before it reaches the page. The original values are never shown or
            exported.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading title="What we do not do" />
          <ul className="flex flex-col gap-2.5">
            <ProseBullet>
              Upload your resume, or its text, to any server, API or storage service.
            </ProseBullet>
            <ProseBullet>
              Send resume content to AI services, OCR services or error-reporting tools.
            </ProseBullet>
            <ProseBullet>
              Store resume text, parsed sections or personal information in localStorage or
              cookies.
            </ProseBullet>
            <ProseBullet>
              Put your name, contact details or any resume content into a URL or page metadata.
            </ProseBullet>
            <ProseBullet>
              Create shareable links to reports — there is no server-side report to link to.
            </ProseBullet>
            <ProseBullet>
              Include resume content in analytics events, if and when analytics are added.
            </ProseBullet>
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading title="What is stored on your device" />
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            One preference: your theme choice — light, dark or system — stored in localStorage under
            the key <code className="bg-sheet-tint px-1.5 py-0.5 text-[13px]">resumegauge-theme</code>
            . It holds no personal data and exists so the page looks the way you left it. Everything
            about your resume lives in memory for the current tab and is discarded when you use
            Remove or Clear report, close the tab, or navigate away.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading title="Your control over your data" />
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            You can remove the analyzed file, the extracted text and the report at any time, using
            Remove on the upload screen or Clear report in the report header. Both discard the
            document data immediately. Because we never receive the file, there is nothing further to
            request, export or delete on our side.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading title="Security handling" />
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            Uploaded files are treated as untrusted input. We validate the file type by extension and
            by file signature, enforce a size limit of {formatFileSize(MAX_UPLOAD_BYTES)}, never
            execute document content, and never render extracted text as HTML. Parsing failures are
            handled as recoverable states rather than crashes.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading title="Changes to this policy" />
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            If a future version ever needs to send data off your device — an optional server-side
            feature, for example — this page will state what is transmitted, why, where it goes and
            whether it is retained, before the feature ships. The current version transmits nothing.
          </p>
        </section>

        <section className="flex flex-col gap-4 border-t border-rule pt-8">
          <SectionHeading title="Contact" />
          <p className="text-[15px] leading-relaxed text-ink-2">
            Questions about this policy can be sent to{" "}
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