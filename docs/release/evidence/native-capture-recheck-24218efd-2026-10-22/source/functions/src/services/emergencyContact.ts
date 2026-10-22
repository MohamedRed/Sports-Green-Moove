import { Timestamp, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { emergencyContactId, emergencyContactRecordSchema, emergencyDigest, emergencyOperationId,
  legacyChildEmergencyContactId, type EmergencyTarget, type EmergencyWrite } from "../domain/emergencyContact.js";
import { firestore } from "../lib/firebase.js";
import { requireEmergencyContactAuthority } from "./emergencyContactAuthority.js";

type ContactIdentity = Awaited<ReturnType<typeof requireEmergencyContactAuthority>>;
function identityFields(identity: ContactIdentity) {
  return { subjectId: identity.subjectId, ...(identity.childInstanceId ? { childInstanceId: identity.childInstanceId } : {}) };
}
function receiptFields(identity: ContactIdentity) {
  return { ...identityFields(identity), ...(identity.childInstanceId ? { clubId: identity.clubId } : {}) };
}
function readRecord(snapshot: DocumentSnapshot, kind: EmergencyTarget["kind"], identity: ContactIdentity) {
  if (!snapshot.exists) return undefined;
  const parsed = emergencyContactRecordSchema.safeParse(snapshot.data());
  if (!parsed.success || parsed.data.kind !== kind || parsed.data.subjectId !== identity.subjectId ||
      parsed.data.childInstanceId !== identity.childInstanceId) {
    throw new HttpsError("failed-precondition", "The contact record requires review.");
  }
  return parsed.data;
}
async function requireNoLegacyChildContact(transaction: Transaction, kind: EmergencyTarget["kind"], identity: ContactIdentity) {
  if (kind === "child" && (await transaction.get(firestore.collection("emergencyContacts").doc(legacyChildEmergencyContactId(identity.subjectId)))).exists)
    throw new HttpsError("failed-precondition", "An unbound legacy child contact requires explicit review.");
}

export async function readEmergencyContact(uid: string, token: unknown, target: EmergencyTarget) {
  return firestore.runTransaction(async (transaction) => {
    const identity = await requireEmergencyContactAuthority(transaction, uid, token, target);
    await requireNoLegacyChildContact(transaction, target.kind, identity);
    const snapshot = await transaction.get(firestore.collection("emergencyContacts").doc(emergencyContactId(target.kind, identity.subjectId, identity.childInstanceId)));
    const record = readRecord(snapshot, target.kind, identity);
    return { kind: target.kind, ...identity, contact: record?.contact ?? null, revision: record?.revision ?? 0 };
  });
}

export async function writeEmergencyContact(uid: string, token: unknown, input: EmergencyWrite) {
  return firestore.runTransaction(async (transaction) => {
    // Reading authority inside this transaction fences a simultaneous revocation or membership change.
    const identity = await requireEmergencyContactAuthority(transaction, uid, token, input.target);
    if (input.expectedChildInstanceId !== identity.childInstanceId)
      throw new HttpsError("failed-precondition", "The child identity changed. Reload before saving.");
    await requireNoLegacyChildContact(transaction, input.target.kind, identity);
    const contactId = emergencyContactId(input.target.kind, identity.subjectId, identity.childInstanceId);
    const ref = firestore.collection("emergencyContacts").doc(contactId);
    const operationRef = firestore.collection("emergencyContactOperations").doc(emergencyOperationId(uid, input.requestId));
    const [snapshot, operation] = await transaction.getAll(ref, operationRef);
    const current = readRecord(snapshot, input.target.kind, identity);
    const fingerprint = emergencyDigest([input.target, input.expectedRevision, input.contact,
      ...(identity.childInstanceId ? [identity.childInstanceId] : [])]);
    if (operation.exists) {
      if (operation.get("actorUserId") !== uid || operation.get("contactId") !== contactId ||
          operation.get("fingerprint") !== fingerprint || !current) {
        throw new HttpsError("already-exists", "This operation identity belongs to a different request.");
      }
      return { kind: input.target.kind, ...receiptFields(identity), revision: current.revision, replayed: true };
    }
    if ((current?.revision ?? 0) !== input.expectedRevision) {
      throw new HttpsError("failed-precondition", "The contact changed. Reload before saving.");
    }
    if (!current && input.contact === null) throw new HttpsError("failed-precondition", "There is no saved contact to remove.");
    const now = Timestamp.now(), revision = input.expectedRevision + 1;
    transaction.set(ref, { kind: input.target.kind, ...identityFields(identity), contact: input.contact, revision,
      ...(input.target.kind === "child" ? { guardianClubId: identity.clubId } : {}),
      lastActorUserId: uid, createdAt: current?.createdAt ?? now, updatedAt: now });
    transaction.create(operationRef, { actorUserId: uid, contactId, fingerprint, revision, createdAt: now });
    return { kind: input.target.kind, ...receiptFields(identity), revision, replayed: false };
  });
}
