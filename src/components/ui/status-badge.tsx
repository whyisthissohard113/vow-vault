import type { ReactNode } from "react";

import { Badge, type BadgeTone } from "@/components/ui/badge";

export function statusTone(status: string | null | undefined): BadgeTone {
  switch (status) {
    case "completed":
    case "active":
    case "published":
    case "approved":
    case "paid":
    case "live":
    case "success":
      return "success";
    case "pending":
    case "processing":
    case "building":
    case "awaiting_payment":
    case "queued":
      return "warning";
    case "failed":
    case "expired":
    case "revoked":
    case "cancelled":
    case "rejected":
    case "pending_approval":
      return "danger";
    default:
      return "neutral";
  }
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function StatusBadge({
  status,
  children,
}: {
  status: string | null | undefined;
  children?: ReactNode;
}) {
  return <Badge tone={statusTone(status)}>{children ?? statusLabel(status)}</Badge>;
}