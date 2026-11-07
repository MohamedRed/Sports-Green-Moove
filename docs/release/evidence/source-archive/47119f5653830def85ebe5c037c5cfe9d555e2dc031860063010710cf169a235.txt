import { Timestamp } from "firebase-admin/firestore";

export type MembershipRecord = {
  status?: unknown;
  active?: unknown;
};

export type MembershipRequestData = {
  userId: string;
  clubId: string;
  role: "member";
  status: "requested";
  active: false;
  requestedAt: Timestamp;
  updatedAt: Timestamp;
};

const REQUESTABLE_STATUSES = new Set(["rejected", "cancelled", "inactive"]);

export function membershipDocumentId(userId: string, clubId: string): string {
  return `${userId}_${clubId}`;
}

export function membershipRequestStatus(record: MembershipRecord | undefined): string | null {
  if (!record) return null;
  const status = typeof record.status === "string" && record.status.length > 0 ? record.status : undefined;
  if (record.active === true && !status) return "active";
  return status ?? "requested";
}

export function canRequestMembership(record: MembershipRecord | undefined): boolean {
  const status = membershipRequestStatus(record);
  return status == null || REQUESTABLE_STATUSES.has(status);
}

export function membershipRequestData(userId: string, clubId: string, now = Timestamp.now()): MembershipRequestData {
  return {
    userId,
    clubId,
    role: "member",
    status: "requested",
    active: false,
    requestedAt: now,
    updatedAt: now,
  };
}
