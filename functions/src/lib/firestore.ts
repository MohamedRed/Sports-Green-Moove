import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();
export const firestore = getFirestore();
// Preserve ABORTED for the transaction runner instead of retrying a closed query token.
firestore.settings({ gaxServerStreamingRetries: true });
