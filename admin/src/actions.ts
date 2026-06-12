import { doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firestore, functions } from "./firebase";
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

export async function setReportStatus(reportId: string, status: "open" | "reviewing" | "closed"): Promise<void> {
  if (!firestore) throw new Error("Firebase Firestore is not configured.");
  await updateDoc(doc(firestore, "reports", reportId), {
    status,
    updatedAt: new Date(),
  });
}
