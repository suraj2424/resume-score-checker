"use client";

import * as React from "react";
import { useImperativeHandle, useRef } from "react";
import { FileText, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/utils/format";
import { MAX_UPLOAD_BYTES } from "@/config/scoring";
import { cn } from "@/lib/utils/cn";

const MAX_SIZE_LABEL = formatFileSize(MAX_UPLOAD_BYTES);

export interface SelectedFile {
  file: File;
  name: string;
  size: number;
}

/**
 * Lets the parent open the picker — for the retry and error states, which sit
 * outside this component.
 */
export interface ResumeUploaderHandle {
  browse: () => void;
}

export const ResumeUploader = React.forwardRef<
  ResumeUploaderHandle,
  {
    selectedFile: SelectedFile | null;
    disabled?: boolean;
    isDragging: boolean;
    accept: string;
    onDragStateChange: (dragging: boolean) => void;
    onFilesSelected: (files: FileList) => void;
    onRemove: () => void;
  }
>(function ResumeUploader(
  { selectedFile, disabled = false, isDragging, accept, onDragStateChange, onFilesSelected, onRemove },
  ref,
) {
  // This component owns the only file input on the page. The visible control is
  // a real button that asks the input to open, rather than a file input styled
  // to look like a button: nesting one inside the other meant the click never
  // reached the input at all.
  const inputRef = useRef<HTMLInputElement | null>(null);

  useImperativeHandle(
    ref,
    () => ({ browse: () => inputRef.current?.click() }),
    [],
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onDragStateChange(false);
    if (disabled) return;
    if (event.dataTransfer?.files?.length) {
      onFilesSelected(event.dataTransfer.files);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) onDragStateChange(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          onDragStateChange(false);
        }}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col gap-5 border border-dashed p-6 transition-colors sm:p-8",
          isDragging ? "border-ink bg-accent" : "border-rule-2 bg-sheet hover:border-ink-3",
          disabled && "opacity-60",
        )}
        aria-disabled={disabled}
      >
        <div className="flex flex-col gap-2">
          <p className="label">PDF or DOCX, up to {MAX_SIZE_LABEL}</p>
          <p className="max-w-[34ch] text-[1.5rem] font-semibold leading-[1.15] tracking-[-0.026em] text-ink sm:text-[1.75rem]">
            {isDragging ? "Release to start the check" : "Drop your resume here"}
          </p>
          <p className="max-w-[52ch] text-[15px] leading-relaxed text-ink-2">
            Read in this browser tab and never uploaded. An image-only PDF has no text to read —
            export a text-based PDF, or upload the DOCX.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            const files = event.target.files;
            if (files && files.length > 0) onFilesSelected(files);
            event.target.value = "";
          }}
          aria-label="Choose a resume file"
        />

        <Button
          size="lg"
          className="w-full"
          disabled={disabled}
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          <FileText aria-hidden="true" />
          {selectedFile ? "Choose a different file" : "Choose a file"}
        </Button>

        <p className="text-[13px] text-ink-3">Or drag the file anywhere into this panel.</p>
      </div>

      {selectedFile ? (
        <div className="flex flex-wrap items-center gap-3 border border-rule bg-sheet-tint px-4 py-3">
          <span
            aria-hidden="true"
            className="figure shrink-0 border border-rule bg-sheet px-2 py-1 text-ink"
          >
            {selectedFile.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-ink" title={selectedFile.name}>
              {selectedFile.name}
            </p>
            <p className="figure text-ink-3">{formatFileSize(selectedFile.size)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Replace
            </Button>
            <Button type="button" variant="quiet" size="sm" disabled={disabled} onClick={onRemove}>
              <X className="size-3.5" aria-hidden="true" />
              Remove
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
});