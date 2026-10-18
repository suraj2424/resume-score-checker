import { PageContainer } from "@/components/layout/page-container";

/**
 * A skeleton of the `/check` screen, not a spinner.
 *
 * The upload panel is the one thing on this page a visitor came for, so the
 * shape it occupies is worth showing while the route streams in — a centred
 * spinner tells the reader nothing about what is arriving. Every bar is ink at
 * low opacity: a skeleton has no result behind it, and colour in this system
 * always means there is one.
 *
 * `role="status"` announces the wait once, then the real page takes over. The
 * bars themselves are decorative and hidden from assistive tech.
 */

function Bar({ className }: { className: string }) {
  return <div aria-hidden="true" className={`bg-ink/10 ${className}`} />;
}

export default function CheckLoading() {
  return (
    <PageContainer size="wide" className="py-8 sm:py-12">
      <div role="status" aria-busy="true" className="flex flex-col gap-8">
        <span className="sr-only">Loading the resume check.</span>

        <div className="flex flex-col gap-3 border-b border-rule pb-7">
          <Bar className="h-[13px] w-28" />
          <Bar className="h-9 w-[min(28ch,80%)] sm:h-11" />
          <Bar className="h-[17px] w-[min(62ch,92%)]" />
        </div>

        <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="slab flex flex-col gap-5 p-6 sm:p-8">
              <div className="flex flex-col gap-2">
                <Bar className="h-[13px] w-44" />
                <Bar className="h-7 w-[min(34ch,70%)]" />
                <Bar className="h-[15px] w-[min(52ch,95%)]" />
                <Bar className="h-[15px] w-[min(44ch,80%)]" />
              </div>
              <Bar className="h-12 w-full" />
              <Bar className="h-[13px] w-64" />
            </div>
          </div>

          <aside className="flex min-w-0 flex-col gap-8">
            <div className="flex flex-col border-t border-rule">
              <div className="border-b border-rule py-3">
                <Bar className="h-[13px] w-36" />
              </div>
              <div className="flex flex-col">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex gap-3 border-b border-rule py-3.5 last:border-b-0">
                    <Bar className="h-[15px] w-6 shrink-0" />
                    <div className="flex flex-1 flex-col gap-2">
                      <Bar className="h-[14px] w-[min(24ch,80%)]" />
                      <Bar className="h-[13px] w-[min(38ch,95%)]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Bar className="h-[13px] w-44" />
              <Bar className="h-[15px] w-[min(46ch,90%)]" />
              <Bar className="h-[15px] w-[min(40ch,80%)]" />
              <Bar className="h-[12px] w-64" />
            </div>
          </aside>
        </div>
      </div>
    </PageContainer>
  );
}
