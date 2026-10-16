"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { AppError } from "@/lib/utils/errors";
import { siteConfig } from "@/config/site";

/**
 * Recoverable failure states for the upload flow: a rejected file, a parse
 * failure, or a document with no extractable text. Each state says what went
 * wrong and what to do instead.
 */
export function AnalysisError({
  error,
  fileName,
  onRetry,
  onChooseAnother,
}: {
  error: AppError;
  fileName?: string;
  onRetry?: () => void;
  onChooseAnother: () => void;
}) {
  const kind = error.code;
  const noText = kind === "no-text-extracted";

  const title = noText
    ? "No readable text found"
    : kind === "unsupported-type"
      ? "Unsupported file"
      : kind === "file-too-large"
        ? "File too large"
        : kind === "empty-file"
          ? "Empty file"
          : "This file could not be analyzed";

  return (
    <div className="flex flex-col gap-4">
      <Alert tone={noText ? "caution" : "issue"} surface="wash">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <p>{error.message}</p>
          {error.hint ? <p>{error.hint}</p> : null}
          {fileName && kind !== "unsupported-type" ? <p className="figure">File: {fileName}</p> : null}
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center gap-2">
        {onRetry ? (
          <Button type="button" variant="secondary" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        ) : null}
        <Button type="button" onClick={onChooseAnother}>
          Choose a different file
        </Button>
        <Link href={siteConfig.links.faq} className="link ml-1 text-[14px] font-medium">
          Why did this happen?
        </Link>
      </div>
    </div>
  );
}