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
    const activeAuth = auth;
    let generation = 0;
    const unsubscribe = onIdTokenChanged(activeAuth, async (user) => {
      const ticket = ++generation;
      if (!user) {
        setState({ user: null, roleKeys: [], loading: false, error: null });
        return;
      }
      setState({ user, roleKeys: [], loading: true, error: null });
      try {
        const token = await user.getIdTokenResult();
        if (ticket !== generation || activeAuth.currentUser?.uid !== user.uid) return;
        const roleKeys = Array.isArray(token.claims.roleKeys) ? token.claims.roleKeys.map(String) : [];
        setState({ user, roleKeys, loading: false, error: null });
      } catch (error) {
        if (ticket !== generation || activeAuth.currentUser?.uid !== user.uid) return;
        setState({
          user,
          roleKeys: [],
          loading: false,
          error: error instanceof Error ? error.message : "Unable to read auth claims.",
        });
      }
    });
    return () => { ++generation; unsubscribe(); };
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
