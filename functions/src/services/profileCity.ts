import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { profileCityFingerprint, profileCityRecordSchema, type ProfileCityWrite } from "../domain/profileCity.js";
import { firestore } from "../lib/firebase.js";

function record(snapshot: DocumentSnapshot, uid: string) {
  if (!snapshot.exists) return undefined;
  const parsed = profileCityRecordSchema.safeParse(snapshot.data());
  if (!parsed.success || parsed.data.userId !== uid || parsed.data.city !== snapshot.get("city") ||
      parsed.data.lastFingerprint !== profileCityFingerprint({ city: parsed.data.city,
        expectedRevision: parsed.data.revision - 1, requestId: parsed.data.lastRequestId }))
    throw new HttpsError("failed-precondition", "The profile city requires review.");
  return parsed.data;
}
export async function readProfileCity(uid: string) {
  const current = record(await firestore.collection("profileCities").doc(uid).get(), uid);
  return { userId: uid, city: current?.city ?? null, revision: current?.revision ?? 0 };
}
export async function writeProfileCity(uid: string, input: ProfileCityWrite) {
  return firestore.runTransaction(async (transaction) => {
    const ref = firestore.collection("profileCities").doc(uid);
    const current = record(await transaction.get(ref), uid);
    const fingerprint = profileCityFingerprint(input);
    if (current?.lastRequestId === input.requestId) {
      if (current.lastFingerprint !== fingerprint)
        throw new HttpsError("already-exists", "The request identity belongs to another change.");
      return { userId: uid, city: current.city, revision: current.revision };
    }
    if ((current?.revision ?? 0) !== input.expectedRevision)
      throw new HttpsError("failed-precondition", "The city changed. Reload before saving.");
    const revision = input.expectedRevision + 1;
    // A null city is retained with its revision so an old creation cannot restore it.
    transaction.set(ref, { userId: uid, city: input.city, revision, lastRequestId: input.requestId,
      lastFingerprint: fingerprint, updatedAt: Timestamp.now() });
    return { userId: uid, city: input.city, revision };
  });
}
