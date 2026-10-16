/**
 * Typed, user-facing errors. Parsing and validation failures are surfaced as
 * `AppError` instances so the UI can show honest, actionable messages without
 * leaking stack traces or internal details.
 */

export type AppErrorCode =
  | "unsupported-type"
  | "file-too-large"
  | "empty-file"
  | "parse-failed"
  | "no-text-extracted"
  | "analysis-failed"
  | "unknown";

export interface AppErrorOptions {
  code: AppErrorCode;
  message: string;
  /** Short guidance shown next to the message. */
  hint?: string;
  /** Whether offering a retry makes sense for this failure. */
  retryable?: boolean;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly hint?: string;
  readonly retryable: boolean;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.hint = options.hint;
    this.retryable = options.retryable ?? false;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Convert any thrown value into a user-safe AppError. */
export function toAppError(error: unknown, fallbackMessage = "Something went wrong."): AppError {
  if (isAppError(error)) return error;
  // Never surface raw internals for unknown failures: show a generic message
  // and keep the original on the console + `cause` for debugging.
  if (typeof console !== "undefined" && typeof console.error === "function") {
    console.error("[unknown-error]", error);
  }
  return new AppError({
    code: "unknown",
    message: fallbackMessage,
    retryable: false,
    cause: error,
  });
}
