import Link from "next/link";
import { AccordionItem } from "@/components/ui/accordion";
import { SectionHeading } from "@/components/ui/section-heading";
import { MAX_UPLOAD_BYTES, SCORING_CATEGORIES, SCORING_VERSION } from "@/config/scoring";
import { siteConfig } from "@/config/site";
import { ALL_CHECKS } from "@/lib/resume/rules";
import { formatFileSize } from "@/lib/utils/format";

const CHECK_COUNT = ALL_CHECKS.length;
const CATEGORY_COUNT = SCORING_CATEGORIES.length;
const MAX_SIZE_LABEL = formatFileSize(MAX_UPLOAD_BYTES);

const FAQS = [
  {
    question: "What is the resume score?",
    answer: `A number from 0 to 100 against our published checklist of ${CHECK_COUNT} checks in ${CATEGORY_COUNT} categories. Every point shows the check that earned it, and the weights are published in full.`,
  },
  {
    question: "Does a high score guarantee an ATS pass?",
    answer:
      "No. This is not an applicant tracking system. A high score means you avoid the common formatting and content problems that make documents harder to parse and read — it does not guarantee any particular platform will accept the file.",
  },
  {
    question: "Which file formats are supported?",
    answer: `PDF and DOCX up to ${MAX_SIZE_LABEL}. The type is verified by extension and by file signature, so a renamed file is rejected rather than misread.`,
  },
  {
    question: "Is AI used to read my resume?",
    answer:
      "No. Scoring is deterministic: the same document and scoring version always produce the same score. No model, no external request.",
  },
  {
    question: "Is my file stored anywhere?",
    answer:
      "No. Parsing and scoring happen in this browser tab. Nothing is uploaded, logged or written to storage, and closing the tab discards everything.",
  },
  {
    question: "Why might my score differ from another checker?",
    answer:
      "Different checkers use different rules and different weights. Ours are published on the scoring page — compare the individual checks rather than the single number.",
  },
  {
    question: "Can I check a resume with little work experience?",
    answer:
      "Yes. Internships, projects, certifications and education count as experience. You are not marked down for a short employment history.",
  },
  {
    question: "What if my PDF is a scan?",
    answer:
      "An image-only PDF has no selectable text and we do not run OCR. We say so plainly rather than guessing — export a text-based PDF, or upload the DOCX instead.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-24 border-t border-edge py-14 lg:py-20">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <SectionHeading
            label="Questions"
            title="Before you upload."
            description="What the tool does, what it does not, and what happens to your file."
          />
          <p className="text-[14px] leading-relaxed text-ink-2">
            The full weighting is on the{" "}
            <Link href={siteConfig.links.howScoringWorks} className="link">
              scoring page
            </Link>{" "}
            <span className="figure">v{SCORING_VERSION}</span>.
          </p>
        </div>

        <div className="flex flex-col border-t border-rule">
          {FAQS.map((faq, index) => (
            <AccordionItem key={faq.question} title={faq.question} defaultOpen={index === 0}>
              <p className="max-w-[66ch]">{faq.answer}</p>
            </AccordionItem>
          ))}
        </div>
      </div>
    </section>
  );
}