import type { ResumeCheck } from "../types";

/**
 * Contact checks are deliberately role-aware. A missing LinkedIn URL is a
 * suggestion, not a failure, and GitHub is presented as role-dependent.
 * Evidence never echoes actual contact details back to the user.
 *
 * Role-aware means every one of these checks reaches its own verdict from its own
 * facts. `contact-linkedin` used to return `issue` when the other contact
 * channels were missing too, which charged a resume without an email for having
 * no email three times over - once here and once in each of the two checks that
 * actually report it - and contradicted the intent written in this header.
 */
export const contactChecks: ResumeCheck[] = [
  {
    id: "contact-email",
    categoryId: "contact",
    title: "Email address",
    description: "Whether the resume includes a professional email address.",
    severity: "high",
    points: 5,
    evaluate: (resume) => {
      if (resume.contact.hasEmail) {
        return {
          status: "pass",
          explanation:
            "An email address was detected. Recruiters use it as the primary contact channel.",
          confidence: "high",
        };
      }
      return {
        status: "issue",
        explanation:
          "No email address was detected. Without one, a recruiter has no reliable way to reach you.",
        recommendation:
          "Add a professional email address near the top of your resume, and check it for typos.",
        confidence: "high",
      };
    },
  },
  {
    id: "contact-phone",
    categoryId: "contact",
    title: "Phone number",
    description: "Whether the resume includes a phone number.",
    severity: "high",
    points: 5,
    evaluate: (resume) => {
      if (resume.contact.hasPhone) {
        return {
          status: "pass",
          explanation: "A phone number was detected.",
          confidence: "high",
        };
      }
      return {
        status: "issue",
        explanation:
          "No phone number was detected. Many recruiters still call or text candidates before emailing.",
        recommendation:
          "Add a phone number with country code if you are applying across borders.",
        confidence: "medium",
      };
    },
  },
  {
    id: "contact-linkedin",
    categoryId: "contact",
    title: "LinkedIn profile",
    description:
      "Whether the resume links to a LinkedIn profile. Recommended, but not required.",
    severity: "medium",
    points: 3,
    evaluate: (resume) => {
      if (resume.contact.hasLinkedIn) {
        return {
          status: "pass",
          explanation:
            "A LinkedIn profile link was detected. It gives recruiters more context beyond one page.",
          confidence: "high",
        };
      }
      const { hasEmail, hasPhone, hasPortfolio, hasGitHub } = resume.contact;
      const hasOtherChannel = hasEmail || hasPhone || hasPortfolio || hasGitHub;

      if (hasOtherChannel) {
        return {
          status: "warning",
          explanation:
            "No LinkedIn link was found. Your other details are present, so a recruiter can reach you and see your work; LinkedIn is a helpful addition rather than a requirement.",
          recommendation:
            "If you keep your LinkedIn profile up to date, add the profile URL to your contact details.",
          confidence: "high",
        };
      }
      return {
        status: "warning",
        explanation:
          "No LinkedIn link was found. A LinkedIn profile is an addition to your contact details, not one of them, so this is the same suggestion rather than a second report of the missing email address and phone number, which the two checks above already report.",
        recommendation:
          "Add your email and phone number first, then a LinkedIn profile URL if you have one.",
        confidence: "medium",
      };
    },
  },
  {
    id: "contact-additional-links",
    categoryId: "contact",
    title: "Portfolio or GitHub link where relevant",
    description:
      "Whether the resume links to work samples such as a portfolio or GitHub profile, where relevant to the role.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      // `hasPortfolio` means a link that looks like the candidate's own site: a
      // personal or portfolio-shaped domain, with or without a scheme. An article
      // link, a documentation reference or a framework name is not a portfolio and
      // no longer counts here.
      if (resume.contact.hasPortfolio || resume.contact.hasGitHub) {
        const found: string[] = [];
        if (resume.contact.hasGitHub) found.push("GitHub");
        if (resume.contact.hasPortfolio) found.push("a link to your own site");
        return {
          status: "pass",
          explanation: `${found.join(" and ")} ${found.length > 1 ? "were" : "was"} detected, letting recruiters verify your work directly.`,
          confidence: "high",
        };
      }
      return {
        status: "warning",
        explanation:
          "No link to your own site or a code repository was found. Whether this matters depends on the role: software and design recruiters often look for one, while many operations and finance roles do not expect it.",
        recommendation:
          "If you have public work samples, add a link to them. Do not create an empty profile just for this.",
        confidence: "medium",
      };
    },
  },
];
