import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../lib/firebase.js";
import type { OnboardingDependencies, OnboardingSession } from "../domain/stripeOnboarding.js";
import { createConnectedAccountLink, createStripeClient } from "./stripeConnect.js";

export function stripeOnboardingDependencies(secret: string): OnboardingDependencies {
  return {
    async saveSession(hash, session) {
      await firestore.collection("stripeAccounts").doc(session.userId).set({
        onboardingTokenHash: hash,
        onboardingExpiresAt: session.expiresAt,
        lastAccountLinkCreatedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }, { merge: true });
    },
    async loadSession(hash) {
      const snapshot = await firestore.collection("stripeAccounts")
        .where("onboardingTokenHash", "==", hash).limit(1).get();
      const document = snapshot.docs[0];
      const data = document?.data();
      if (!document || typeof data?.stripeAccountId !== "string" || typeof data.onboardingExpiresAt !== "number") return undefined;
      return {
        userId: document.id, stripeAccountId: data.stripeAccountId, expiresAt: data.onboardingExpiresAt,
      } satisfies OnboardingSession;
    },
    createLink: (input) => createConnectedAccountLink(input, secret),
    retrieveAccount: (id) => createStripeClient(secret).accounts.retrieve(id),
    async saveAccountStatus(session, account) {
      await firestore.collection("stripeAccounts").doc(session.userId).set({
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    },
  };
}
