/**
 * Test setup: polyfills required by libraries when running in Node.
 *
 * pdfjs-dist constructs a DOMMatrix at module scope in its display layer.
 * Browsers always provide the real implementation; in Node tests we only
 * need the constructor to exist because text extraction never touches it.
 */

type DOMMatrixLike = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  multiply: () => DOMMatrixLike;
  preMultiplySelf: () => DOMMatrixLike;
  translate: () => DOMMatrixLike;
  scale: () => DOMMatrixLike;
  invertSelf: () => DOMMatrixLike;
};

if (typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix === "undefined") {
  class DOMMatrixStub implements DOMMatrixLike {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;

    // No constructor: pdf.js only needs the type to exist for text extraction.

    multiply() {
      return this;
    }

    preMultiplySelf() {
      return this;
    }

    translate() {
      return this;
    }

    scale() {
      return this;
    }

    invertSelf() {
      return this;
    }
  }

  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = DOMMatrixStub;
}
