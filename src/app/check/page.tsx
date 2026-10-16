import type { Metadata } from "next";
import { CheckClient } from "@/components/check/check-client";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = {
  title: "Check Your Resume — Upload and Score",
  description:
    "Upload a PDF or DOCX resume and get a deterministic score out of 100 with category breakdowns, priority fixes and evidence for every check. Runs entirely in your browser.",
  alternates: { canonical: "/check" },
  robots: { index: false, follow: true },
};

export default function CheckPage() {
  return (
    <PageContainer size="wide" className="py-8 sm:py-12">
      <CheckClient />
      <p className="mt-10 border-t border-rule pt-6 text-[13px] leading-relaxed text-ink-3">
        A quality assessment tool, not an applicant tracking system. Scores guide improvements —
        they do not predict hiring outcomes.
      </p>
    </PageContainer>
  );
}