/**
 * Synthetic resume fixtures for tests.
 *
 * Every fixture is invented for testing. None of them contains real personal
 * data, and they are deliberately varied: experienced, fresher, minimal,
 * no-sections, inconsistent headings and dates, first-person heavy,
 * weak wording, duplicates, generic skills, and image-only text.
 */

import type { SourceDocument } from "@/lib/resume/types";

export function sourceFromText(
  text: string,
  overrides: Partial<SourceDocument> = {},
): SourceDocument {
  return {
    fileName: "fixture-resume.docx",
    fileType: "docx",
    text,
    warnings: [],
    ...overrides,
  };
}

export const EXPERIENCED_RESUME = `Jane Doe
Senior Backend Engineer
jane.doe@example.com | +1 (555) 123-4567 | linkedin.com/in/janedoe | github.com/janedoe

SUMMARY
Backend engineer with 6 years building payment services in Python and Go.

EXPERIENCE
Senior Backend Engineer, Acme Payments, Mar 2021 - Present
- Designed and shipped a payment reconciliation service processing 2M transactions daily, reducing manual review time by 60%
- Led a team of 5 engineers migrating legacy batch jobs to event-driven services on Kafka
- Improved API p99 latency from 850ms to 120ms through query optimization and caching
- Mentored 3 junior engineers through code review and pairing sessions

Backend Engineer, Bluefin Systems, Jun 2018 - Feb 2021
- Built and maintained REST APIs in Python serving 400 concurrent clients
- Automated the deployment pipeline with GitHub Actions, cutting release time from 2 days to 30 minutes
- Implemented OAuth2 authorization for partner integrations across 12 services

EDUCATION
B.S. Computer Science, University of Example, Aug 2014 - May 2018

SKILLS
Python, Go, PostgreSQL, Kafka, Docker, Kubernetes, AWS, Redis, REST API design, unit testing, microservices, CI/CD, Terraform

PROJECTS
- Open-source task queue library with 1.2k GitHub stars used by more than 40 teams
`;

export const FRESHER_RESUME = `Priya Sharma
priya.sharma@example.com | +91 98765 43210

EDUCATION
B.Tech in Computer Engineering, Example Institute of Technology, Aug 2022 - Jun 2026
CGPA: 8.6/10

PROJECTS
- Built a campus event management web app in React and Node.js used by 1,200 students
- Implemented certificate generation and email notifications for 15 college events
- Designed the database schema and REST API for a food-delivery tracker in Python

INTERNSHIPS
Software Engineering Intern, Example Labs, May 2025 - Jul 2025
- Developed internal dashboards in TypeScript and React for the operations team
- Wrote unit tests raising coverage from 45% to 80%

SKILLS
Python, JavaScript, React, Node.js, SQL, Git, REST APIs, unit testing

CERTIFICATIONS
AWS Certified Cloud Practitioner, 2025
`;

export const MINIMAL_RESUME = `Sam Lee
sam.lee@example.com
`;

export const NO_SECTIONS_RESUME = `I am a very motivated professional looking for new opportunities. I have worked on many interesting projects over the years and I am always eager to learn new things and take on additional responsibility whenever the team needs it. My experience includes working with customers, helping colleagues, and supporting day to day operations in a fast paced environment. I believe I would be a great addition to any team because I work hard and I am a fast learner who pays close attention to detail. Please feel free to contact me at alex.morgan@example.com or call 555-010-2020 for more information about my background and skills.
`;

export const MIXED_HEADINGS_RESUME = `Jordan Rivera
jordan.rivera@example.com | 555-010-3030

EXPERIENCE
Operations Lead, Example Logistics, Jan 2023 - Dec 2024
- Coordinated deliveries for a 20 vehicle fleet
- Reduced fuel spend by 12% through route planning

Education
Bachelor of Commerce, Example University, 2019 - 2022

skills
Excel, process improvement, stakeholder management, logistics
`;

export const INCONSISTENT_DATES_RESUME = `Casey Brooks
casey.brooks@example.com

EXPERIENCE
Analyst, Northwind Trading, Mar 2021 - 06/2022
- Cleaned daily sales reports for 8 storefronts
- Built a weekly forecast used by the buying team

Advisor, Southridge Group, 2020-03 to 2021-Feb
- Supported 30 client accounts during a system migration
- Documented the new onboarding workflow

EDUCATION
B.A. Economics, Example College, 15/06/2018
`;

export const FIRST_PERSON_RESUME = `Taylor Kim
taylor.kim@example.com

SUMMARY
I am a marketing specialist who enjoys building campaigns.

EXPERIENCE
Marketing Associate, Bright Media, Jan 2022 - Present
- I planned and launched 6 email campaigns for our subscriber list
- I managed my team's social calendar across 3 channels
- My analysis of open rates improved our subject lines
- I supported trade show booths at 4 industry events
`;

export const WEAK_WORDING_RESUME = `Morgan Ellis
morgan.ellis@example.com

EXPERIENCE
Office Assistant, Example Group, Feb 2021 - Dec 2022
- Responsible for answering phones and scheduling meetings
- Helped with data entry and filing for the department
- Worked on various tasks as needed by the team
- Assisted with onboarding new hires each quarter

EDUCATION
High school diploma, Example School, 2017 - 2021
`;

export const DUPLICATE_BULLETS_RESUME = `Riley Foster
riley.foster@example.com

EXPERIENCE
Support Engineer, Example SaaS, Mar 2022 - Present
- Resolved 40 support tickets per week for enterprise customers
- Resolved 40 support tickets per week for enterprise customers
- Documented the top 10 recurring issues for the knowledge base
- Documented the top 10 recurring issues for the knowledge base
`;

export const GENERIC_SKILLS_RESUME = `Avery Stone
avery.stone@example.com | 555-010-4040

SKILLS
Teamwork, leadership, communication, problem solving, time management, hardworking, motivated, detail-oriented, passionate, adaptable, flexible, creative, strategic, collaborative, organized, efficient

EXPERIENCE
General Assistant, Example Office, 2022 - 2024
- Performed general duties as assigned each day
`;

export const SCANNED_LIKE_RESUME = `���PDF EXPORT���

��� Scanning artifact detected ���

� Error: image layer only �
`;

export const EMPTY_RESUME = "";

/** A long, dense single document used for stress and reliability checks. */
export const LONG_RESUME = [
  "Devon Park",
  "devon.park@example.com | +1 555 010 5050 | linkedin.com/in/devonpark",
  "",
  "SUMMARY",
  "Full-stack engineer with a decade of delivery experience.",
  "",
  "EXPERIENCE",
  ...Array.from({ length: 12 }, (_, index) =>
    [
      `Engineer ${index + 1}, Company ${index + 1}, Mar ${2015 + index} - Feb ${2016 + index}`,
      `- Delivered feature set ${index + 1} serving ${index + 2}00 users`,
      `- Refactored service ${index + 1} reducing defects by ${index + 3}%`,
    ].join("\n"),
  ),
  "",
  "EDUCATION",
  "B.S. Software Engineering, Example University, Sep 2011 - Jun 2015",
  "",
  "SKILLS",
  "TypeScript, React, Node.js, PostgreSQL, AWS, Docker, Kubernetes, Redis, GraphQL, CI/CD",
].join("\n");

/* ------------------------------------------------------------------ */
/* Fixtures for the Tech Interview Handbook validations                */
/* ------------------------------------------------------------------ */

/** Roles listed oldest first, which is the ordering the handbook warns about. */
export const OUT_OF_ORDER_RESUME = `Noor Haddad
noor.haddad@example.com | 555-010-4242

EXPERIENCE
Analyst, Southridge Group, 2018 - 2020
- Rebuilt the weekly forecast used by the buying team
- Supported 30 client accounts during a system migration

Senior Analyst, Northwind Trading, 03/2021 - Present
- Cut month-end close from 9 days to 3 by automating 14 reconciliations
- Mentored two analysts through their first reporting cycle

EDUCATION
B.Sc. Statistics, Example College, 2014 - 2018

SKILLS
SQL, Python, dbt, Snowflake, Airflow, Tableau, Excel, PostgreSQL
`;

/** Emoji in headings and in the body, which the plain-text-file test catches. */
export const GLYPH_HEAVY_RESUME = `Robin Ellis
robin.ellis@example.com | 555-010-5151

SUMMARY
Backend engineer focused on payments infrastructure and reliability.

EXPERIENCE ✨
Engineer, Example Startup, 2022 - Present
- Shipped the billing rewrite, cutting p99 latency by 40% and error rate by a third
- Owned the on-call rotation for 14 months and wrote the runbook the team still uses
- Moved the ledger service to Postgres, removing a nightly reconciliation job

EDUCATION 🎓
B.Sc. Computer Science, Example University, 2018 - 2022

SKILLS ⭐
TypeScript, React, Node.js, PostgreSQL, Docker, Kubernetes, AWS, Terraform, Redis
`;

/**
 * Ordinary typographic punctuation — curly quotes, en dashes, parentheses — that
 * must NOT be mistaken for pictographs. This is the regression guard for the
 * character-set check being too eager.
 */
export const CLEAN_PUNCTUATION_RESUME = `Yusuf Demir
yusuf.demir@example.com | 555-010-7272

EXPERIENCE
Engineer, Acme, 2021 - Present
- Cut p99 latency by 40% — across 3 services (p99: 300ms)
- Partnered with the “payments” team to ship the new ledger
- Maintained on-call rota for 2 years; wrote the incident playbook

EDUCATION
B.Eng. Software Engineering, Example University, 2016 - 2020

SKILLS
C++, Rust, Go, Python, PostgreSQL, Kafka, Kubernetes, Terraform, Docker, Redis
`;

/** A summary far longer than the handbook's 50-word guidance. */
export const LONG_SUMMARY_RESUME = `Dana Whitfield
dana.whitfield@example.com | 555-010-6161

SUMMARY
I am a passionate and highly motivated software engineer with a proven track
record of delivering high quality solutions across a wide range of industries
and business domains. Over the years I have had the opportunity to work with
many talented teams and I have always believed that the best results come from
close collaboration, clear communication and a genuine love of learning. I
specialise in backend systems, distributed computing and developer tooling,
although I am comfortable working across the stack. I have led teams of up to
twelve engineers and I have mentored more junior colleagues than I can count.

EXPERIENCE
Engineer, Example Corp, 2021 - Present
- Reduced infrastructure cost by 30% by rightsizing workloads
- Led a migration of 3 million records with no downtime

EDUCATION
B.Sc. Software Engineering, Example University, 2012 - 2016

SKILLS
Python, Go, Kubernetes, AWS, Postgres, Kafka, Terraform, Docker, Redis, CI/CD
`;
