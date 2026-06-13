export const REPORT_STATUSES = ["open", "reviewing", "closed"] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export function normalizeReportReviewNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function reportClosedAtValue<T>(status: ReportStatus, value: T): T | null {
  return status === "closed" ? value : null;
}
