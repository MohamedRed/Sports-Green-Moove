import { getApps, initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { localFirebaseConfig } from "./localFirebaseConfig";

const useLocalEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true";
const firebaseConfig = useLocalEmulators ? localFirebaseConfig(import.meta.env.DEV) : {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

export const firebaseApp = hasFirebaseConfig ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig)) : undefined;
if (useLocalEmulators && firebaseApp?.options.projectId !== "demo-sgm-local-qa") {
  throw new Error("Local management testing refuses an existing live app.");
}
export const firebaseProjectLabel = firebaseApp?.options.projectId ?? "configuration required";
export const auth = firebaseApp ? getAuth(firebaseApp) : undefined;
export const firestore = firebaseApp ? getFirestore(firebaseApp) : undefined;
export const realtimeDb = firebaseApp ? getDatabase(firebaseApp) : undefined;
export const functions = firebaseApp ? getFunctions(firebaseApp) : undefined;

if (useLocalEmulators) {
  if (auth && firestore && realtimeDb && functions) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
    connectDatabaseEmulator(realtimeDb, "127.0.0.1", 9000);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
}
