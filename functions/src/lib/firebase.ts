import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
export { firestore } from "./firestore.js";

export const auth = getAuth();
export const realtimeDb = getDatabase();
