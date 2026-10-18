import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { emergencyContactId, emergencyContactRecordSchema, emergencyDigest, emergencyOperationId,
  type EmergencyTarget, type EmergencyWrite } from "../domain/emergencyContact.js";
import { firestore } from "../lib/firebase.js";
import { requireEmergencyContactAuthority } from "./emergencyContactAuthority.js";

function readRecord(snapshot: DocumentSnapshot, kind: EmergencyTarget["kind"], subjectId: string) {
  if (!snapshot.exists) return undefined;
  const parsed = emergencyContactRecordSchema.safeParse(snapshot.data());
  if (!parsed.success || parsed.data.kind !== kind || parsed.data.subjectId !== subjectId) {
    throw new HttpsError("failed-precondition", "The contact record requires review.");
  }
  return parsed.data;
}

export async function readEmergencyContact(uid: string, token: unknown, target: EmergencyTarget) {
  return firestore.runTransaction(async (transaction) => {
    const subjectId = await requireEmergencyContactAuthority(transaction, uid, token, target);
    const snapshot = await transaction.get(firestore.collection("emergencyContacts").doc(emergencyContactId(target.kind, subjectId)));
    const record = readRecord(snapshot, target.kind, subjectId);
    return { kind: target.kind, subjectId, contact: record?.contact ?? null, revision: record?.revision ?? 0 };
  });
}

export async function writeEmergencyContact(uid: string, token: unknown, input: EmergencyWrite) {
  return firestore.runTransaction(async (transaction) => {
    // Reading authority inside this transaction fences a simultaneous revocation or membership change.
    const subjectId = await requireEmergencyContactAuthority(transaction, uid, token, input.target);
    const contactId = emergencyContactId(input.target.kind, subjectId);
    const ref = firestore.collection("emergencyContacts").doc(contactId);
    const operationRef = firestore.collection("emergencyContactOperations").doc(emergencyOperationId(uid, input.requestId));
    const [snapshot, operation] = await transaction.getAll(ref, operationRef);
    const current = readRecord(snapshot, input.target.kind, subjectId);
    const fingerprint = emergencyDigest([input.target, input.expectedRevision, input.contact]);
    if (operation.exists) {
      if (operation.get("actorUserId") !== uid || operation.get("contactId") !== contactId ||
          operation.get("fingerprint") !== fingerprint || !current) {
        throw new HttpsError("already-exists", "This operation identity belongs to a different request.");
      }
      return { kind: input.target.kind, subjectId, revision: current.revision, replayed: true };
    }
    if ((current?.revision ?? 0) !== input.expectedRevision) {
      throw new HttpsError("failed-precondition", "The contact changed. Reload before saving.");
    }
    if (!current && input.contact === null) throw new HttpsError("failed-precondition", "There is no saved contact to remove.");
    const now = Timestamp.now(), revision = input.expectedRevision + 1;
    transaction.set(ref, { kind: input.target.kind, subjectId, contact: input.contact, revision,
      lastActorUserId: uid, createdAt: current?.createdAt ?? now, updatedAt: now });
    transaction.create(operationRef, { actorUserId: uid, contactId, fingerprint, revision, createdAt: now });
    return { kind: input.target.kind, subjectId, revision, replayed: false };
  });
}
