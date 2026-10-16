/**
 * A single ruled row of facts. Each item is a claim the product can actually
 * stand behind — no badges, no star ratings, no invented trust signals.
 */

const CLAIMS = [
  { label: "Reads on your device" },
  { label: "No account" },
  { label: "No AI scoring" },
  { label: "Weights published" },
  { label: "Free" },
];

export function TrustIndicators() {
  return (
    <section aria-label="Key facts" className="border-t border-edge py-5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-baseline sm:gap-7">
        <p className="label shrink-0">Before you upload</p>
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {CLAIMS.map((claim) => (
            <li key={claim.label} className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-pass" />
              {claim.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}