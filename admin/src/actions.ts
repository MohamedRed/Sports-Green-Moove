import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { RoleMap } from "./types";

export const emptyRoles: RoleMap = {
  admin: false,
  child: false,
  clubManager: false,
  driver: false,
  parent: false,
};

export async function setUserRoles(userId: string, roles: RoleMap): Promise<void> {
  if (!functions) throw new Error("Firebase Functions is not configured.");
  await httpsCallable(functions, "setUserRoles")({ userId, roles });
}

export async function issueRewardPayout(userId: string, amountCents: number): Promise<void> {
  if (!functions) throw new Error("Firebase Functions is not configured.");
  await httpsCallable(functions, "issueRewardPayout")({
    userId,
    amountCents,
    sourceId: `admin-${Date.now()}`,
  });
}

export type ReportStatus = "open" | "reviewing" | "closed";

export async function reviewReport(reportId: string, status: ReportStatus, note: string): Promise<void> {
  if (!functions) throw new Error("Firebase Functions is not configured.");
  const trimmedNote = note.trim();
  await httpsCallable(functions, "reviewReport")({
    reportId,
    status,
    note: trimmedNote.length > 0 ? trimmedNote : undefined,
  });
}
