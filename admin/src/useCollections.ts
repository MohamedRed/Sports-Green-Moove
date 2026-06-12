import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query } from "firebase/firestore";
import { firestore } from "./firebase";
import type { CollectionState, FirestoreRecord, PayoutCandidate } from "./types";
import { numberValue } from "./format";

export function useCollection<T extends FirestoreRecord>(
  path: string,
  maxDocs = 50,
): CollectionState<T> {
  const [state, setState] = useState<CollectionState<T>>({
    items: [],
    loading: Boolean(firestore),
    error: null,
  });

  useEffect(() => {
    if (!firestore) {
      setState({ items: [], loading: false, error: "Firebase Firestore is not configured." });
      return undefined;
    }

    const ref = query(collection(firestore, path), limit(maxDocs));
    return onSnapshot(
      ref,
      (snapshot) => {
        setState({
          items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as T),
          loading: false,
          error: null,
        });
      },
      (error) => setState({ items: [], loading: false, error: error.message }),
    );
  }, [path, maxDocs]);

  return state;
}

export function usePayoutCandidates(
  ledger: FirestoreRecord[],
  stripeAccounts: FirestoreRecord[],
): PayoutCandidate[] {
  return useMemo(() => {
    const balances = new Map<string, number>();
    for (const entry of ledger) {
      const userId = typeof entry.userId === "string" ? entry.userId : undefined;
      if (!userId) continue;
      balances.set(userId, (balances.get(userId) ?? 0) + numberValue(entry.amountCents));
    }

    return [...balances.entries()]
      .map(([userId, balanceCents]) => {
        const account = stripeAccounts.find((item) => item.id === userId || item.userId === userId);
        return {
          userId,
          balanceCents,
          stripeReady: account?.payoutsEnabled === true,
          stripeAccountId: typeof account?.stripeAccountId === "string" ? account.stripeAccountId : undefined,
        };
      })
      .filter((candidate) => candidate.balanceCents > 0)
      .sort((a, b) => b.balanceCents - a.balanceCents);
  }, [ledger, stripeAccounts]);
}
