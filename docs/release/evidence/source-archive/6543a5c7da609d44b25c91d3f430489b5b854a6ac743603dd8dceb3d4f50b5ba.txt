import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, initializeAuth, inMemoryPersistence } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./firebase";
import { childInvitationTestEndpoints } from "./childInvitationTestEndpoints";

let gateway: ((token: string, email: string, password: string) => Promise<void>) | undefined;
export async function redeemInvitation(token: string, email: string, password: string) {
  const endpoints = childInvitationTestEndpoints({approved: import.meta.env.VITE_INVITATION_SAME_ORIGIN_APPROVED,
    development: import.meta.env.DEV, emulators: import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true",
    projectId: firebaseApp?.options.projectId, origin: window.location.origin});
  if (!gateway) {
    if (!firebaseApp) throw new Error("Invitation service unavailable");
    const name = "child-invitation-signup";
    if (getApps().some(app => app.name === name)) throw new Error("Unexpected invitation session");
    const app = initializeApp(firebaseApp.options, name);
    const auth = initializeAuth(app, { persistence: inMemoryPersistence });
    const functions = getFunctions(app);
    if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true") {
      if (!import.meta.env.DEV || app.options.projectId !== "demo-sgm-local-qa") throw new Error("Isolated invitation configuration required");
      connectAuthEmulator(auth, endpoints.authUrl, { disableWarnings: true });
      connectFunctionsEmulator(functions, endpoints.functionsHost, endpoints.functionsPort);
    }
    const redeem = httpsCallable(functions, "redeemChildInvitation");
    gateway = async (linkToken, address, chosenPassword) => {
      if (auth.currentUser) throw new Error("Unexpected invitation authentication");
      const response = await redeem({ token: linkToken, email: address.trim().toLowerCase(), password: chosenPassword });
      const value = response.data as Record<string, unknown>;
      if (!value || Object.keys(value).sort().join(",") !== "created,parentApprovalRequired" ||
        value.created !== true || value.parentApprovalRequired !== true) throw new Error("Invalid invitation receipt");
    };
  }
  await gateway(token, email, password);
}
