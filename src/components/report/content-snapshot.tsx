import { Badge } from "@/components/ui/badge";
import { signalTone } from "@/components/ui/tones";
import type { FormattingSignal, ParsedResume } from "@/lib/resume/types";

const SEVERITY_LABEL: Record<FormattingSignal["severity"], string> = {
  info: "Note",
  warning: "Watch",
  critical: "Problem",
};

/**
 * Privacy-conscious preview of what was detected. Contact details appear only
 * as presence checks — never as an address, number or link.
 *
 * Found and not-found are results, so they get tones; an empty list is a note,
 * not a failure.
 */
export function ContentSnapshot({ resume }: { resume: ParsedResume }) {
  const skills = resume.skills.slice(0, 12);
  const signals = [
    ...resume.formattingSignals,
    ...resume.parsingWarnings.map((warning) => ({
      type: warning.code,
      severity: "warning" as const,
      confidence: "high" as const,
      explanation: warning.message,
    })),
  ];
  const pageCount =
    resume.pageCount !== undefined
      ? String(resume.pageCount)
      : `about ${Math.max(1, Math.ceil(resume.stats.wordCount / 550))}`;

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-3">
        <SnapshotStat
          tone={resume.stats.wordCount > 200 ? "pass" : "caution"}
          label="Words extracted"
          value={resume.stats.wordCount.toLocaleString("en-US")}
        />
        <SnapshotStat
          tone={resume.pageCount !== undefined && resume.pageCount > 3 ? "caution" : "pass"}
          label="Pages"
          value={pageCount}
        />
        <SnapshotStat
          tone={resume.sections.length >= 3 ? "pass" : "caution"}
          label="Sections identified"
          value={String(resume.sections.length)}
        />
      </dl>

      <div className="flex flex-col gap-3">
        <h4 className="label">Recognized sections</h4>
        {resume.sections.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {resume.sections.map((section) => (
              <li key={section.id}>
                <Badge
                  tone="pass"
                  dot={false}
                  className="border border-rule bg-pass-wash px-2 py-1 text-pass"
                >
                  {section.heading}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-start gap-2 text-[15px] text-ink-2">
            <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-caution" />
            No standard section headings were recognized in this document.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="label">Skill terms recognized</h4>
        {skills.length > 0 ? (
          <>
            <ul className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <li key={skill.term}>
                  <Badge
                    tone="pass"
                    dot={false}
                    className="border border-rule bg-pass-wash px-2 py-1 text-pass"
                  >
                    {skill.term}
                    {skill.count > 1 ? (
                      <span className="tabular pl-1.5 text-pass/70">×{skill.count}</span>
                    ) : null}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink-3">
              Showing {skills.length} of {resume.skills.length} recognized terms. This is a signal
              from a fixed list, not an inventory of everything you know.
            </p>
          </>
        ) : (
          <p className="flex items-start gap-2 text-[15px] text-ink-2">
            <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-mute" />
            Nothing on this document matched our standard term list. That is not a statement about
            what you can do — only about what this list found.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="label">Parsing notes</h4>
        {signals.length > 0 ? (
          <ul className="flex flex-col divide-y divide-rule border-t border-rule">
            {signals.map((signal, index) => (
              <li
                key={`${signal.type}-${index}`}
                className="flex items-start gap-3 py-3 text-[14px] leading-relaxed"
              >
                <span className="w-20 shrink-0 pt-0.5">
                  <Badge tone={signalTone(signal.severity)}>
                    {SEVERITY_LABEL[signal.severity]}
                  </Badge>
                </span>
                <span className="flex-1 text-ink-2">{signal.explanation}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-start gap-2 text-[15px] text-ink-2">
            <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-pass" />
            No parsing problems were detected in this document.
          </p>
        )}
      </div>

      <p className="flex items-start gap-2 border-t border-rule pt-4 text-[13px] leading-relaxed text-ink-3">
        <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-note" />
        This snapshot deliberately does not display your contact details, addresses or links. The
        report records only whether each was present, and nothing is transmitted anywhere.
      </p>
    </div>
  );
}

function SnapshotStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "pass" | "caution";
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-sheet px-4 py-3.5">
      <dt className="label flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${tone === "pass" ? "bg-pass" : "bg-caution"}`}
        />
        {label}
      </dt>
      <dd className="figure-lg text-[1.375rem] leading-none text-ink">{value}</dd>
    </div>
  );
}