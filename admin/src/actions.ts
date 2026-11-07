import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { RoleMap } from "./types";
import { validatePayoutReceipt, type RewardPayoutRequest } from "./rewardPayoutRequest";

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

export async function issueRewardPayout(request: RewardPayoutRequest): Promise<void> {
  if (!functions) throw new Error("Firebase Functions is not configured.");
  const response = await httpsCallable(functions, "issueRewardPayout")({
    ...request,
  });
  validatePayoutReceipt(request, response.data);
}

export type ReportStatus = "open" | "reviewing" | "closed";

export async function reviewReport(reportId: string, status: ReportStatus, note: string): Promise<void> {
  if (!functions) throw new Error("Firebase Functions is not configured.");
  const trimmedNote = note.trim();
  await httpsCallable(functions, "reviewReport")({
    reportId,
    status,
    ...(trimmedNote.length > 0 ? { note: trimmedNote } : {}),
  });
}
