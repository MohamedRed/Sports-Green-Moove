import { useEffect, useState } from "react";
import { onIdTokenChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "./firebase";
import type { AdminAuthState } from "./types";

export function useAdminAuth(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>({
    user: null,
    roleKeys: [],
    loading: Boolean(auth),
    error: null,
  });

  useEffect(() => {
    if (!auth) return undefined;
    return onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, roleKeys: [], loading: false, error: null });
        return;
      }
      try {
        const token = await user.getIdTokenResult(true);
        const roleKeys = Array.isArray(token.claims.roleKeys) ? token.claims.roleKeys.map(String) : [];
        setState({ user, roleKeys, loading: false, error: null });
      } catch (error) {
        setState({
          user,
          roleKeys: [],
          loading: false,
          error: error instanceof Error ? error.message : "Unable to read auth claims.",
        });
      }
    });
  }, []);

  return state;
}

export async function signInAdmin(email: string, password: string): Promise<void> {
  if (!auth) throw new Error("Firebase Auth is not configured.");
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOutAdmin(): Promise<void> {
  if (auth) await signOut(auth);
}
