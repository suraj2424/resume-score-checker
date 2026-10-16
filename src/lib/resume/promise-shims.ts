/**
 * Minimal runtime shims required by parsing libraries.
 *
 * pdfjs-dist v5 relies on `Promise.try`, which current browsers provide but
 * some runtimes (including Node 22) do not. The shim is a no-op wherever the
 * native implementation exists. It must be imported before `pdfjs-dist`.
 */

type PromiseTry = <T>(executor: () => T | PromiseLike<T>) => Promise<T>;

if (typeof (Promise as unknown as { try?: PromiseTry }).try !== "function") {
  const tryImplementation = <T>(executor: () => T | PromiseLike<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      try {
        resolve(executor());
      } catch (error) {
        reject(error);
      }
    });
  (Promise as unknown as { try: PromiseTry }).try = tryImplementation;
}

export {};
