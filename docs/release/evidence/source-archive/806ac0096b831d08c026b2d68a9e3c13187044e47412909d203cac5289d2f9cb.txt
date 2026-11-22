import type { Timestamp, Transaction } from "firebase-admin/firestore";
import { firestore } from "../lib/firebase.js";

export function queueUrgentSupportEmail(transaction: Transaction, reportId: string, emergency: boolean, createdAt: Timestamp) {
  if (!emergency) return;
  transaction.create(firestore.collection("supportUrgentEmailOutbox").doc(reportId), {
    kind: "support-urgent", reportId, audience: "support", status: "queued", attempts: 0, createdAt, updatedAt: createdAt,
  });
}
