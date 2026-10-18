import type { ReactNode } from "react";
import { Badge, TONE_DOT, type Tone } from "@/components/ui/badge";
import {
  pageLengthTone,
  sectionCountTone,
  signalTone,
  snapshotTone,
  wordVolumeTone,
} from "@/components/ui/tones";
import { SCORING_THRESHOLDS } from "@/config/scoring";
import { cn } from "@/lib/utils/cn";
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
 * not a failure. Every judgement here reads `SCORING_THRESHOLDS` rather than a
 * literal: a snapshot that disagrees with the engine about what counts as a
 * short resume is worse than one that reports no colour at all.
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
  // A DOCX often reports no page count at all, so the reading shown and the tone
  // given to it have to come from the same estimated number rather than from a
  // placeholder that always passes.
  const effectivePageCount =
    resume.pageCount ?? Math.max(1, Math.ceil(resume.stats.wordCount / SCORING_THRESHOLDS.wordsPerPage));
  const pageCount =
    resume.pageCount !== undefined ? String(resume.pageCount) : `about ${effectivePageCount}`;

  return (
    <div className="flex flex-col gap-8">
      {/*
        Three children in a `grid-cols-2 … sm:grid-cols-3` grid meant a lone
        third row below 640px, and the empty fourth cell rendered as a solid
        `--color-rule` block: the `gap-px bg-rule` divider trick paints whatever
        the parent's background shows through, so a hole in the grid was a grey
        square on every phone. One column until three fit.
      */}
      <dl className="grid grid-cols-1 gap-px border border-rule bg-rule sm:grid-cols-3">
        <SnapshotStat
          tone={wordVolumeTone(resume.stats.wordCount)}
          label="Words extracted"
          value={resume.stats.wordCount.toLocaleString("en-US")}
        />
        <SnapshotStat
          tone={pageLengthTone(effectivePageCount)}
          label="Pages"
          value={pageCount}
        />
        <SnapshotStat
          tone={sectionCountTone(resume.sections.length)}
          label="Sections identified"
          value={String(resume.sections.length)}
        />
      </dl>

      <div className="flex flex-col gap-3">
        <h3 className="label">Recognized sections</h3>
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
          <SnapshotNote tone={snapshotTone("no-sections-found")}>
            No standard section headings were recognized in this document.
          </SnapshotNote>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="label">Skill terms recognized</h3>
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
          <SnapshotNote tone={snapshotTone("no-terms-found")}>
            Nothing on this document matched our standard term list. That is not a statement about
            what you can do — only about what this list found.
          </SnapshotNote>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="label">Parsing notes</h3>
        {signals.length > 0 ? (
          <ul className="flex flex-col divide-y divide-rule border-t border-rule">
            {signals.map((signal, index) => (
              <li
                key={`${signal.type}-${index}`}
                className="flex items-start gap-3 py-3 text-[14px] leading-relaxed"
              >
                {/* `shrink-0` on the wrapper, not a fixed `w-20`: the badge is
                    `whitespace-nowrap`, so a longer label than the gutter was
                    sized for simply overflowed it. */}
                <span className="shrink-0 pt-0.5">
                  <Badge tone={signalTone(signal.severity)}>{SEVERITY_LABEL[signal.severity]}</Badge>
                </span>
                <span className="min-w-0 flex-1 text-ink-2">{signal.explanation}</span>
              </li>
            ))}
          </ul>
        ) : (
          <SnapshotNote tone={snapshotTone("no-parse-problems")}>
            No parsing problems were detected in this document.
          </SnapshotNote>
        )}
      </div>

      <SnapshotNote tone={snapshotTone("privacy-note")} className="border-t border-rule pt-4">
        This snapshot deliberately does not display your contact details, addresses or links. The
        report records only whether each was present, and nothing is transmitted anywhere.
      </SnapshotNote>
    </div>
  );
}

/** A sentence with a tone dot. The dot is decorative; the sentence is the fact. */
function SnapshotNote({
  tone,
  className,
  children,
}: {
  tone: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <p className={cn("flex items-start gap-2 text-[15px] leading-relaxed text-ink-2", className)}>
      <span aria-hidden="true" className={cn("mt-[0.55em] size-1.5 shrink-0 rounded-full", TONE_DOT[tone])} />
      {children}
    </p>
  );
}

function SnapshotStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-sheet px-4 py-3.5">
      <dt className="label flex items-center gap-2">
        <span aria-hidden="true" className={`size-1.5 rounded-full ${TONE_DOT[tone]}`} />
        {label}
      </dt>
      <dd className="figure-lg text-[1.375rem] leading-none text-ink">{value}</dd>
    </div>
  );
}