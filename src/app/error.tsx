"use client";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * The boundary a route segment falls back to when something below it throws.
 *
 * `error` is deliberately not destructured. It is not logged — AGENTS.md §2.2
 * forbids `console.*` in `src/` — and a Next.js error message can carry
 * internals, so there is nowhere safe to put it. The copy names the failure and
 * offers the one action that can resolve it.
 */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer className="py-16 sm:py-24">
      <EmptyState
        title="Something went wrong."
        description="This part of the page could not be rendered. Trying again usually clears it."
        action={
          <Button onClick={reset}>Try again</Button>
        }
      />
    </PageContainer>
  );
}
