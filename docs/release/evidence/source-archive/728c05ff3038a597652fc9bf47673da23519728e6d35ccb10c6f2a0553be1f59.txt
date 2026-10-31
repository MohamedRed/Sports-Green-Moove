import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";
import type { GuardianReviewGateway } from "./guardianReviewTypes";
import { guardianClub, guardianPage, guardianRecord, guardianReview, guardianStatus } from "./guardianReviewWire";

export function guardianReviewGateway(uid: string): GuardianReviewGateway {
  async function call(name: string, data: unknown): Promise<unknown> {
    if (!functions || auth?.currentUser?.uid !== uid) throw new Error("Session modifiée. Reconnectez-vous.");
    const response = await httpsCallable(functions, name)(data);
    if (auth.currentUser?.uid !== uid) throw new Error("Session modifiée. Reconnectez-vous.");
    return response.data;
  }
  return {
    async clubs(cursor) {
      return guardianPage(await call("listGuardianReviewClubs", cursor ? { cursor } : {}), guardianClub);
    },
    async requests(clubId, cursor) {
      return guardianPage(await call("listClubGuardianVerifications", { clubId, ...(cursor ? { cursor } : {}) }),
        (item) => guardianReview(item, clubId, uid));
    },
    async decide(item, operation) {
      const result = guardianRecord(await call("transitionGuardianVerification", operation));
      if (result.verificationId !== item.id || !Number.isSafeInteger(result.revision) || Number(result.revision) < item.revision ||
          typeof result.replayed !== "boolean") throw new Error("Décision non confirmée.");
      return guardianStatus(result.status);
    },
  };
}
