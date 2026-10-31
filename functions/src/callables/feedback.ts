import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { normalizeReportReviewNote, reportClosedAtValue, REPORT_STATUSES } from "../domain/reports.js";
import { firestore } from "../lib/firebase.js";
import { requireAdmin, requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { queueUrgentSupportEmail } from "../services/supportUrgentQueue.js";
import { submitRideRating } from "../services/ratingSubmission.js";

export const submitRating = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    rideSessionId: z.string(),
    ratedUserId: z.string(),
    score: z.number().int().min(1).max(5),
    comment: z.string().trim().max(500).optional(),
  });
  const data = parseCallableData(schema, request.data);
  return submitRideRating(uid, data);
});

export const createReport = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    subjectType: z.enum(["booking", "rideSession", "message", "user", "other"]),
    subjectId: z.string().optional(),
    reason: z.string().trim().min(2).max(120),
    description: z.string().trim().min(5).max(2000),
    emergency: z.boolean().default(false),
  });
  const data = parseCallableData(schema, request.data);
  const ref = firestore.collection("reports").doc();

  const createdAt = Timestamp.now();
  await firestore.runTransaction(async transaction => {
    transaction.create(ref, {
      ...data,
      reporterUserId: uid,
      status: "open",
      publicReplyCount: 0,
      lastPublicReply: null,
      createdAt,
      updatedAt: createdAt,
    });
    queueUrgentSupportEmail(transaction, ref.id, data.emergency, createdAt);
  });

  return { reportId: ref.id, status: "open" };
});

export const reviewReport = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireAdmin(request.auth?.token);

  const schema = z.object({
    reportId: z.string().trim().min(1),
    status: z.enum(REPORT_STATUSES),
    note: z.string().trim().max(1000).optional(),
  });
  const data = parseCallableData(schema, request.data);
  const reportRef = firestore.collection("reports").doc(data.reportId);
  const reviewedAt = Timestamp.now();
  const note = normalizeReportReviewNote(data.note);
  const event = {
    status: data.status,
    reviewerUserId: uid,
    note,
    reviewedAt,
  };

  await firestore.runTransaction(async (transaction) => {
    const reportSnap = await transaction.get(reportRef);
    if (!reportSnap.exists) throw new HttpsError("not-found", "Report not found.");

    transaction.update(reportRef, {
      status: data.status,
      reviewedByUserId: uid,
      reviewedAt,
      reviewNote: note,
      reviewEvents: FieldValue.arrayUnion(event),
      closedAt: reportClosedAtValue(data.status, reviewedAt),
      updatedAt: reviewedAt,
    });
  });

  return { reportId: data.reportId, status: data.status };
});
