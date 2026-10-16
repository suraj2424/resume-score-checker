import type { Metadata } from "next";
import { CtaSection } from "@/components/landing/cta-section";
import { FaqSection } from "@/components/landing/faq-section";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorks, Methodology } from "@/components/landing/how-it-works";
import { TrustIndicators } from "@/components/landing/trust-indicators";
import { WhatWeCheck } from "@/components/landing/what-we-check";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = {
  title: "Free Resume Score Checker — Structure, Content and ATS Readiness",
  description:
    "Check your resume for structure, readability, content quality and common applicant-tracking-system compatibility issues. Deterministic scoring, no AI, runs in your browser.",
  alternates: { canonical: "/" },
};

/**
 * The page has no outer panel. The masthead, hero and every section that follows
 * share one column and one background, so the page reads top to bottom as a
 * single continuous document rather than a stack of boxes.
 */
export default function HomePage() {
  return (
    <PageContainer size="wide" className="pt-8 sm:pt-10 lg:pt-12">
      <HeroSection />
      <TrustIndicators />
      <HowItWorks />
      <WhatWeCheck />
      <Methodology />
      <FaqSection />
      <CtaSection />
    </PageContainer>
  );
}