"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Replaces the root layout itself, so it has to render `<html>` and `<body>` —
 * everything above it, including the masthead and the skip link, is gone by the
 * time this runs. There is no shell left to fail gracefully into, which is why
 * this says less than `error.tsx` does and does the one thing that can help.
 *
 * `error` is not destructured or logged; see the note in `error.tsx`.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-[920px] flex-col justify-center px-5 py-16 sm:px-8 lg:px-10">
          <EmptyState
            title="The page could not be loaded."
            description="Reloading usually clears it."
            action={
              <Button onClick={reset}>Try again</Button>
            }
          />
        </main>
      </body>
    </html>
  );
}
