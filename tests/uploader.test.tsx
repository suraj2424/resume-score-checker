/**
 * Interaction tests for the resume upload control.
 *
 * The picker is a real button that programmatically opens a hidden file
 * input. These tests prove that wiring end to end in jsdom: clicking the
 * visible button must reach the input, and choosing a file must surface it
 * to the parent. Written with `createElement` because the project's
 * tsconfig uses `jsx: "preserve"` for Next.js.
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  ResumeUploader,
  type ResumeUploaderHandle,
} from "@/components/resume/resume-uploader";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function renderUploader(props?: {
  disabled?: boolean;
  onFilesSelected?: (files: FileList) => void;
  ref?: RefObject<ResumeUploaderHandle | null>;
}) {
  const onFilesSelected = props?.onFilesSelected ?? (() => {});
  await act(async () => {
    root.render(
      createElement(ResumeUploader, {
        selectedFile: null,
        disabled: props?.disabled ?? false,
        isDragging: false,
        accept: ACCEPT,
        onDragStateChange: () => {},
        onFilesSelected,
        onRemove: () => {},
        ref: props?.ref,
      }),
    );
  });
}

function chooseButton(): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((entry) =>
    entry.textContent?.includes("Choose a file"),
  );
  if (!button) throw new Error("Choose a file button not rendered");
  return button;
}

function fileInput(): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error("Hidden file input not rendered");
  return input as HTMLInputElement;
}

function fileListWith(name: string): FileList {
  const file = new File(["dummy"], name, { type: "application/pdf" });
  if (typeof DataTransfer !== "undefined") {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    return transfer.files;
  }
  return { 0: file, length: 1, item: () => file } as unknown as FileList;
}

describe("ResumeUploader", () => {
  it("renders a Choose a file button and a hidden file input with the right accept list", async () => {
    await renderUploader();
    expect(chooseButton().textContent).toContain("Choose a file");
    expect(fileInput().getAttribute("accept")).toBe(ACCEPT);
  });

  it("opens the file picker when the visible button is clicked", async () => {
    await renderUploader();
    const clickSpy = vi.spyOn(fileInput(), "click").mockImplementation(() => {});
    await act(async () => {
      chooseButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("surfaces the chosen file to the parent", async () => {
    let received: FileList | null = null;
    await renderUploader({ onFilesSelected: (files) => (received = files) });
    const input = fileInput();
    Object.defineProperty(input, "files", { value: fileListWith("resume.pdf"), configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(received).not.toBeNull();
    expect(received![0]?.name).toBe("resume.pdf");
  });

  it("exposes browse() on the ref for retry and error states", async () => {
    const ref: RefObject<ResumeUploaderHandle | null> = { current: null };
    await renderUploader({ ref });
    expect(ref.current).not.toBeNull();
    const clickSpy = vi.spyOn(fileInput(), "click").mockImplementation(() => {});
    await act(async () => {
      ref.current?.browse();
    });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("disables the button and the input while analysis is running", async () => {
    await renderUploader({ disabled: true });
    expect(chooseButton().disabled).toBe(true);
    expect(fileInput().disabled).toBe(true);
  });
});
