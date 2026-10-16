import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Brand } from "./brand";
import { PageContainer } from "./page-container";

const FOOTER_SECTIONS = [
  {
    title: "Tool",
    links: [
      { href: siteConfig.links.check, label: "Check my resume" },
      { href: siteConfig.links.howItWorks, label: "How it works" },
      { href: siteConfig.links.whatWeCheck, label: "What we check" },
      { href: siteConfig.links.faq, label: "Questions" },
    ],
  },
  {
    title: "Scoring",
    links: [
      { href: siteConfig.links.howScoringWorks, label: "How scoring works" },
      { href: `${siteConfig.links.howScoringWorks}#ats`, label: "ATS compatibility" },
      { href: `${siteConfig.links.howScoringWorks}#freshers`, label: "Fresher resumes" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: siteConfig.links.privacy, label: "Privacy" },
      { href: siteConfig.links.terms, label: "Terms" },
      { href: siteConfig.links.contact, label: "Contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="no-print border-t border-edge">
      <PageContainer size="wide" className="py-12 sm:py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-3">
            <Brand />
            <p className="max-w-[30ch] text-[15px] leading-relaxed text-ink-2">
              {siteConfig.tagline}
            </p>
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-3">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-pass" />
              Parsed and scored on your device
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.title} aria-label={section.title} className="flex flex-col gap-3">
              <p className="label">{section.title}</p>
              <ul className="flex flex-col gap-2">
                {section.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-[14px] text-ink-2 transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-rule pt-5 text-[12px] leading-relaxed text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="tabular">
            © {new Date().getFullYear()} {siteConfig.name}
          </p>
          <p className="max-w-xl sm:text-right">
            A quality assessment tool. Scores guide improvements — they do not predict hiring
            outcomes.
          </p>
        </div>
      </PageContainer>
    </footer>
  );
}