import type { CheckStatus } from "@/lib/resume/types";
import { Badge } from "@/components/ui/badge";
import { statusTone } from "@/components/ui/tones";

const STATUS_META: Record<CheckStatus, { label: string; short: string }> = {
  pass: { label: "Passed", short: "Pass" },
  warning: { label: "Warning", short: "Warning" },
  issue: { label: "Issue", short: "Issue" },
  "not-applicable": { label: "Not applicable", short: "Not applicable" },
  "unable-to-verify": { label: "Unable to verify", short: "Unable to verify" },
};

/**
 * Status is always a word plus a tone, so a result never depends on colour
 * alone. The word carries the meaning; the colour carries the speed read.
 */
export function CheckStatusBadge({
  status,
  long = false,
  wash = false,
}: {
  status: CheckStatus;
  long?: boolean;
  wash?: boolean;
}) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={statusTone(status)} surface={wash ? "wash" : "plain"}>
      {long ? meta.label : meta.short}
    </Badge>
  );
}

export function statusLabel(status: CheckStatus): string {
  return STATUS_META[status].label;
}