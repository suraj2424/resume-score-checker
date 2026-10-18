"use client";

import { useRef, useState } from "react";
import { AnalysisError } from "@/components/resume/analysis-error";
import { AnalysisProgress, type ProgressStepId } from "@/components/resume/analysis-progress";
import { ResumeUploader, type ResumeUploaderHandle, type SelectedFile } from "@/components/resume/resume-uploader";
import { ReportView } from "@/components/report/report-view";
import { scrollToReportSection } from "@/components/report/score-rail";
import { CheckScoreRail } from "@/components/check/score-rail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import { analyzeResumeFile } from "@/lib/resume/analyze-file";
import type { AppError } from "@/lib/utils/errors";
import { toAppError } from "@/lib/utils/errors";
import type { ParsedResume, ScoreReport } from "@/lib/resume/types";

/**
 * `"dragging"` and `"selected"` were never `setPhase`'d: drag state lives in
 * `isDraggingOver` below, whose old name shadowed the union member outright, and
 * file selection jumps straight to `parsing`. Both entries in `STATUS_MESSAGES`
 * were therefore unreachable, and unreachable live-region copy is worse than
 * none — it reads as a message the user can never trigger.
 */
type Phase = "empty" | "parsing" | "analyzing" | "results" | "rejected" | "error" | "no-text";

const STATUS_MESSAGES: Record<Phase, string> = {
  empty: "Upload a PDF or DOCX resume to begin.",
  parsing: "Reading and extracting text from your resume.",
  analyzing: "Running resume checks.",
  results: "Analysis complete. Your report is ready.",
  rejected: "",
  error: "",
  "no-text": "",
};

/**
 * The three failure phases announce nothing here, on purpose.
 *
 * `AnalysisError` renders an `Alert`, which is `role="alert"` and lands with the
 * phase change carrying a title, a message, a hint and two recovery buttons.
 * A polite region saying "The file could not be analyzed." fired at the same
 * moment said the same thing more weakly, so every failure was announced twice.
 */
const PHASE_FAILURES: ReadonlySet<Phase> = new Set<Phase>(["rejected", "error", "no-text"]);

export function CheckClient() {
  const [phase, setPhase] = useState<Phase>("empty");
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [resume, setResume] = useState<ParsedResume | null>(null);
  const [report, setReport] = useState<ScoreReport | null>(null);
  // Not `dragging`: the old name collided with a `Phase` member it had nothing
  // to do with, which is how a union member ended up shadowed by a boolean.
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const runIdRef = useRef(0);
  const uploaderRef = useRef<ResumeUploaderHandle | null>(null);

  const FILE_ACCEPT =
    ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const pickFile = () => uploaderRef.current?.browse();

  const startAnalysis = async (file: File) => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    setSelected({ file, name: file.name, size: file.size });
    setError(null);
    setReport(null);
    setResume(null);
    setActiveCategoryId(null);
    setPhase("parsing");

    const isStale = () => runId !== runIdRef.current;

    try {
      const outcome = await analyzeResumeFile(file);
      if (isStale()) return;

      setResume(outcome.resume);
      setPhase("analyzing");

      // One frame between the two phases. Without it `parsing` and `analyzing`
      // both resolve inside the same task and the browser never paints the
      // extraction step, so the progress list jumps straight to the checks.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      if (isStale()) return;

      setReport(outcome.report);
      setPhase("results");
    } catch (caught) {
      if (isStale()) return;
      const appError = toAppError(caught);
      setError(appError);
      setPhase(
        appError.code === "no-text-extracted"
          ? "no-text"
          : appError.code === "unsupported-type" ||
              appError.code === "file-too-large" ||
              appError.code === "empty-file"
            ? "rejected"
            : "error",
      );
    }
  };

  const handleFilesSelected = (files: FileList) => {
    const file = files[0];
    if (!file) return;
    void startAnalysis(file);
  };

  const clearAll = () => {
    runIdRef.current += 1;
    setSelected(null);
    setError(null);
    setResume(null);
    setReport(null);
    setActiveCategoryId(null);
    setPhase("empty");
    setConfirmClearOpen(false);
  };

  /**
   * Filter, scroll and move focus as one action.
   *
   * The old version only scrolled, which left a keyboard or screen-reader user
   * at an empty position about a screen below where focus still was, with no
   * word that anything had changed. `#detailed-checks` carries `tabIndex={-1}`
   * so it can receive focus without joining the tab order.
   */
  const inspectCategory = (categoryId: string | null) => {
    setActiveCategoryId(categoryId);
    if (categoryId) scrollToReportSection("detailed-checks");
  };

  const showResults = phase === "results" && report !== null && resume !== null;
  const isBusy = phase === "parsing" || phase === "analyzing";
  const progressStep: ProgressStepId = phase === "analyzing" ? "checking" : "extracting";
  const liveMessage = PHASE_FAILURES.has(phase) ? "" : STATUS_MESSAGES[phase];

  return (
    <div className="flex flex-col gap-8">
      {/* Exactly one `h1` per render. `ReportHeader` supplies the report's own
          (visually hidden, and a stable noun phrase), so the page heading steps
          aside when there is a report to describe. */}
      {!showResults ? (
        <div className="flex flex-col gap-3 border-b border-rule pb-7">
          <p className="label">Resume check</p>
          {/* The base `h1` rule is the scale now; a local size here is what made
              four different h1 sizes on four routes. */}
          <h1 className="max-w-[18ch]">Check your resume.</h1>
          <p className="max-w-[62ch] text-[17px] leading-relaxed text-ink-2">
            A score out of 100, a breakdown by category, and the fixes worth making first — all in
            this tab.
          </p>
        </div>
      ) : null}

      {/*
        Persistent shell. The right column never unmounts its position; only its
        contents swap, so the score, the privacy note and the output actions stay
        on screen for the whole session. The results layout is the narrower
        `17rem` the report rail was specified at — the report needs its whole
        body column more than a proportional rail does.
      */}
      <div
        className={cn(
          "grid min-w-0 items-start gap-10 lg:gap-14",
          showResults ? "lg:grid-cols-[minmax(0,1fr)_17rem]" : "lg:grid-cols-[1.15fr_0.85fr]",
        )}
      >
        <div className="flex min-w-0 flex-col gap-4">
          {!showResults ? (
            <>
              <ResumeUploader
                ref={uploaderRef}
                selectedFile={selected}
                disabled={isBusy}
                isDragging={isDraggingOver}
                accept={FILE_ACCEPT}
                onDragStateChange={setIsDraggingOver}
                onFilesSelected={handleFilesSelected}
                onRemove={clearAll}
              />

              {isBusy ? (
                <AnalysisProgress
                  activeStep={progressStep}
                  fileName={selected?.name ?? "your resume"}
                />
              ) : null}

              {phase === "rejected" || phase === "error" || phase === "no-text" ? (
                <AnalysisError
                  error={
                    error ?? {
                      name: "AppError",
                      code: "unknown",
                      message: "Something went wrong.",
                      hint: undefined,
                      retryable: false,
                    }
                  }
                  fileName={selected?.name}
                  onRetry={
                    selected && phase !== "rejected" ? () => void startAnalysis(selected.file) : undefined
                  }
                  onChooseAnother={pickFile}
                />
              ) : null}
            </>
          ) : (
            <ReportView
              report={report}
              resume={resume}
              onCheckAnother={clearAll}
              onClearReport={() => setConfirmClearOpen(true)}
              rail={false}
              controlledCategoryId={activeCategoryId}
              onActiveCategoryIdChange={setActiveCategoryId}
              onInspectCategory={inspectCategory}
            />
          )}
        </div>

        <CheckScoreRail
          report={report ?? undefined}
          resume={resume ?? undefined}
          onClearReport={() => setConfirmClearOpen(true)}
          activeCategoryId={activeCategoryId}
          onInspectCategory={inspectCategory}
        />
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {liveMessage}
        {phase === "results" && report ? ` Score ${report.score} out of 100.` : ""}
      </p>

      <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear this report?</DialogTitle>
            <DialogDescription>
              This removes the analyzed file, the extracted text and the report from this tab. You
              will start from a clean upload screen. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="quiet" onClick={() => setConfirmClearOpen(false)}>
              Keep the report
            </Button>
            <Button variant="danger" onClick={clearAll}>
              Clear the report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}