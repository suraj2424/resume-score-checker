import { describe, expect, it } from "vitest";
import { detectContact } from "@/lib/resume/contact-detector";

describe("detectContact", () => {
  it("detects email, phone, LinkedIn, GitHub and portfolio links", () => {
    const contact = detectContact(
      "jane.doe@example.com +1 (555) 123-4567 linkedin.com/in/janedoe github.com/janedoe https://janedoe.dev",
    );
    expect(contact.hasEmail).toBe(true);
    expect(contact.hasPhone).toBe(true);
    expect(contact.hasLinkedIn).toBe(true);
    expect(contact.hasGitHub).toBe(true);
    expect(contact.hasPortfolio).toBe(true);
  });

  it("does not classify date ranges as phone numbers", () => {
    const contact = detectContact("Engineer, Jan 2018 - Feb 2021\n2014 - 2018");
    expect(contact.hasPhone).toBe(false);
  });

  it("does not treat a graduation year as a phone number", () => {
    expect(detectContact("B.S. 2014 - 2018").hasPhone).toBe(false);
    expect(detectContact("CGPA: 8.6/10").hasPhone).toBe(false);
  });

  it("handles varied phone formats", () => {
    expect(detectContact("+91 98765 43210").hasPhone).toBe(true);
    expect(detectContact("(555) 010-2020").hasPhone).toBe(true);
    expect(detectContact("555.010.9090").hasPhone).toBe(true);
    expect(detectContact("+44 20 7946 0958").hasPhone).toBe(true);
  });

  it("returns false for documents with no contact information", () => {
    const contact = detectContact("Backend engineer with six years of experience in Go.");
    expect(contact).toEqual({
      hasEmail: false,
      hasPhone: false,
      hasLinkedIn: false,
      hasPortfolio: false,
      hasGitHub: false,
      otherLinkCount: 0,
    });
  });

  it("never returns personal data values, only booleans and counts", () => {
    const contact = detectContact("jane@example.com 555-010-2020 linkedin.com/in/jane");
    expect(Object.values(contact).every((value) => typeof value === "boolean" || typeof value === "number")).toBe(true);
    expect(JSON.stringify(contact)).not.toContain("jane@example.com");
  });
});
