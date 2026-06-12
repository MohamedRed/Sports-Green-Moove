import type { User } from "firebase/auth";

export type RoleKey = "admin" | "child" | "clubManager" | "driver" | "parent";

export type RoleMap = Record<RoleKey, boolean>;

export type AdminAuthState = {
  user: User | null;
  roleKeys: string[];
  loading: boolean;
  error: string | null;
};

export type FirestoreRecord = {
  id: string;
  [key: string]: unknown;
};

export type CollectionState<T extends FirestoreRecord> = {
  items: T[];
  loading: boolean;
  error: string | null;
};

export type Metric = {
  label: string;
  value: string;
  trend: string;
};

export type PayoutCandidate = {
  userId: string;
  balanceCents: number;
  stripeReady: boolean;
  stripeAccountId?: string;
};
