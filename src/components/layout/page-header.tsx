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
      {/* No size here on purpose: the base `h1` rule in `globals.css` is the
          scale, and this override was one of four h1 sizes on the site that all
          claimed the same slot. `text-ink` stays because the base rule sets
          colour from the token and a prose page has no reason to differ. */}
      <h1 className="max-w-[18ch] text-ink">{title}</h1>
      <div className="flex flex-col gap-3">
        <p className="max-w-[58ch] text-[17px] leading-relaxed text-ink-2">{standfirst}</p>
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