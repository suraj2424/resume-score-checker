/**
 * A sample document with a reviewer's marks in the margin.
 *
 * This is not a product screenshot and not a mock browser window — it is the
 * thing the product actually produces: a page of text with the problem marked
 * and a note, set in the gutter, on the line it refers to. The excerpt is
 * illustrative; every number shown around it comes from the real scoring
 * configuration.
 */

export function ProofExcerpt() {
  return (
    <figure className="slab-sunk flex flex-col">
      <figcaption className="flex items-center justify-between gap-4 border-b border-rule px-5 py-2.5">
        <span className="label">Example — sample-resume.pdf</span>
        <span className="figure text-ink-3">Page 1 of 1</span>
      </figcaption>

      <div className="flex flex-col gap-7 px-5 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-col gap-1">
          <p className="text-[17px] font-bold tracking-[-0.02em] text-ink">Ada Okonkwo</p>
          <p className="text-[13px] text-ink-2">Backend Engineer</p>
        </header>

        <section className="grid gap-x-8 gap-y-2 border-t border-rule pt-6 md:grid-cols-[8.5rem_1fr]">
          <div className="md:col-start-2">
            <h3 className="label text-ink-3">Experience</h3>
          </div>
          <div className="flex flex-col gap-2 md:col-start-2">
            <p className="text-[14px] leading-relaxed text-ink-2">
              Engineer, Corvid Systems <span className="figure text-ink-3">2021 –</span>
            </p>
            <ul className="flex flex-col gap-1.5">
              {[
                "Responsible for the billing service",
                "Migrated the billing database",
                "Worked on reliability improvements",
                "Helped with the on-call rotation",
              ].map((line) => (
                <li key={line} className="flex gap-2 text-[14px] leading-relaxed text-ink-2">
                  <span aria-hidden="true" className="mt-[0.55em] size-1 shrink-0 rounded-full bg-rule-2" />
                  {line}
                </li>
              ))}
            </ul>
            <p className="mark-wash -mx-1 mt-1 w-fit rounded-[2px] border-l-2 border-issue px-1.5 py-1 text-[12px] leading-relaxed text-mark-ink">
              Issue · no outcome is stated in any of these lines.
            </p>
          </div>
          <p className="margin-note self-start text-[12px] leading-relaxed text-ink-2 md:col-start-1 md:row-start-2">
            <span className="figure block text-ink-3">bullets</span>
            Six bullets, none carrying a number.
          </p>
        </section>

        <section className="grid gap-x-8 gap-y-2 border-t border-rule pt-6 md:grid-cols-[8.5rem_1fr]">
          <div className="md:col-start-2">
            <h3 className="label text-ink-3">Skills</h3>
          </div>
          <div className="flex flex-col gap-1.5 md:col-start-2">
            <p className="text-[14px] leading-relaxed text-ink-2">
              Familiar with Python, Postgres, Docker, Kubernetes and AWS
            </p>
            <p className="figure text-ink-3">01/04/2021 — 12/2022</p>
            <p className="mark-wash -mx-1 mt-1 w-fit rounded-[2px] border-l-2 border-caution px-1.5 py-1 text-[12px] leading-relaxed text-mark-ink">
              Warning · two date formats, and skills read as prose.
            </p>
          </div>
          <p className="margin-note self-start text-[12px] leading-relaxed text-ink-2 md:col-start-1 md:row-start-2">
            <span className="figure block text-ink-3">dates</span>
            Pick one date format and use it everywhere.
          </p>
        </section>
      </div>
    </figure>
  );
}