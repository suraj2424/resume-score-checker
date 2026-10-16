/** Format a file size in bytes as a short human-readable string. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Format an integer with locale-independent grouping. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/** "1 page" / "3 pages" */
export function pluralize(count: number, singular: string, plural?: string) {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${word}`;
}
