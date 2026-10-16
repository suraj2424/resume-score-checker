/**
 * The head of a long-form page: a rule, a signpost, a title and one
 * standfirst. No tracked-out eyebrow, no decorative rule above the fold — the
 * rule under the standfirst is what separates the page head from its body.
 */
export function PageHeader({
  label,
  title,
  standfirst,
  meta,
}: {
  label: string;
  title: string;
  standfirst: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-rule-2 pb-8">
      <p className="label">{label}</p>
      <h1 className="max-w-[18ch] text-[2.25rem] leading-[1.03] tracking-[-0.032em] text-ink sm:text-[2.875rem]">
        {title}
      </h1>
      <div className="flex flex-col gap-3">
        <p className="max-w-[64ch] text-[17px] leading-relaxed text-ink-2">{standfirst}</p>
        {meta ? <p className="figure text-ink-3">{meta}</p> : null}
      </div>
    </header>
  );
}

/** A plain ruled bullet for long-form body copy. */
export function ProseBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
      <span aria-hidden="true" className="mt-[0.65em] size-1 shrink-0 rounded-full bg-rule-2" />
      <span className="max-w-[66ch]">{children}</span>
    </li>
  );
}