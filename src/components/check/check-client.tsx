"use client";

import * as React from "react";
import { useRef, useState } from "react";
import { AnalysisError } from "@/components/resume/analysis-error";
import { AnalysisProgress, type ProgressStepId } from "@/components/resume/analysis-progress";
import { ResumeUploader, type ResumeUploaderHandle, type SelectedFile } from "@/components/resume/resume-uploader";
import { ReportView } from "@/components/report/report-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { analyzeResumeFile } from "@/lib/resume/analyze-file";
import type { AppError } from "@/lib/utils/errors";
import { toAppError } from "@/lib/utils/errors";
import type { ParsedResume, ScoreReport } from "@/lib/resume/types";

type Phase =
  | "empty"
  | "dragging"
  | "selected"
  | "parsing"
  | "analyzing"
  | "results"
  | "rejected"
  | "error"
  | "no-text";

const STATUS_MESSAGES: Record<Phase, string> = {
  empty: "Upload a PDF or DOCX resume to begin.",
  dragging: "Release the file to start the check.",
  selected: "File selected. Starting the check.",
  parsing: "Reading and extracting text from your resume.",
  analyzing: "Running resume checks.",
  results: "Analysis complete. Your report is ready.",
  rejected: "That file was not accepted.",
  error: "The file could not be analyzed.",
  "no-text": "No readable text was found in that file.",
};

const WORKFLOW = [
  { title: "Parsed here, not on a server", body: "Sections, bullets and contact signals are extracted in this tab." },
  { title: "Scored against the published checks", body: `Fixed checks across five categories. Nothing is guessed.` },
  { title: "Evidence attached", body: "Every point shows what was found and what to change." },
];

export function CheckClient() {
  const [phase, setPhase] = useState<Phase>("empty");
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [resume, setResume] = useState<ParsedResume | null>(null);
  const [report, setReport] = useState<ScoreReport | null>(null);
  const [dragging, setDragging] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

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
    setPhase("parsing");

    const isStale = () => runId !== runIdRef.current;

    try {
      const outcome = await analyzeResumeFile(file);
      if (isStale()) return;

      setResume(outcome.resume);
      setPhase("analyzing");

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
    setPhase("empty");
    setConfirmClearOpen(false);
  };

  const showResults = phase === "results" && report && resume;
  const isBusy = phase === "parsing" || phase === "analyzing";
  const progressStep: ProgressStepId = phase === "analyzing" ? "checking" : "extracting";

  return (
    <div className="flex flex-col gap-8">
      {!showResults ? (
        <>
          <div className="flex flex-col gap-3 border-b border-rule pb-7">
            <p className="label">Resume check</p>
            <h1 className="max-w-[18ch] text-[2rem] leading-[1.05] tracking-[-0.032em] text-ink sm:text-[2.75rem]">
              Check your resume.
            </h1>
            <p className="max-w-[62ch] text-[17px] leading-relaxed text-ink-2">
              A score out of 100, a breakdown by category, and the fixes worth making first — all
              in this tab.
            </p>
          </div>

          <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
            <div className="flex min-w-0 flex-col gap-4">
              <ResumeUploader
                ref={uploaderRef}
                selectedFile={selected}
                disabled={isBusy}
                isDragging={dragging}
                accept={FILE_ACCEPT}
                onDragStateChange={setDragging}
                onFilesSelected={handleFilesSelected}
                onRemove={clearAll}
              />

              {isBusy ? (
                <AnalysisProgress activeStep={progressStep} fileName={selected?.name ?? "your resume"} />
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
            </div>

            <aside className="flex min-w-0 flex-col gap-8 lg:sticky lg:top-24">
              <div className="flex flex-col border-t border-rule">
                <p className="label border-b border-rule py-3">What happens here</p>
                <ol className="flex flex-col">
                  {WORKFLOW.map((step, index) => (
                    <li
                      key={step.title}
                      className="flex gap-3 border-b border-rule py-3.5 last:border-b-0"
                    >
                      <span className="figure shrink-0 pt-0.5 text-ink-3">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="flex flex-col gap-1">
                        <span className="text-[14px] font-semibold text-ink">{step.title}</span>
                        <span className="max-w-[38ch] text-[13px] leading-relaxed text-ink-2">
                          {step.body}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-col gap-2">
                <p className="label">What happens to your file</p>
                <ul className="flex flex-col gap-1.5 text-[14px] leading-relaxed text-ink-2">
                  <li>Parsed and scored in this tab — never uploaded.</li>
                  <li>Never written to storage. Closing the tab discards it.</li>
                  <li>Removed immediately with Remove or Clear report.</li>
                </ul>
                <p className="figure pt-1 text-ink-3">No OCR, no AI analysis, no external requests</p>
              </div>
            </aside>
          </div>
        </>
      ) : (
        <ReportView
          report={report}
          resume={resume}
          onCheckAnother={clearAll}
          onClearReport={() => setConfirmClearOpen(true)}
        />
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {STATUS_MESSAGES[phase]}
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