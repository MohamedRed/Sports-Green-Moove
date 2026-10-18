import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { nextTeamEnrollmentStatus, requestTeamEnrollmentSchema, teamEnrollmentFingerprint, teamEnrollmentId,
  teamEnrollmentOperationId, teamEnrollmentRecordSchema, teamInstanceId, transitionTeamEnrollmentSchema } from "../domain/teamEnrollment.js";

describe("server-owned team enrollment", () => {
  const first = new Timestamp(100, 1), second = new Timestamp(100, 2);
  const instance = teamInstanceId("team", "club", first);
  const request = { teamId: "team", expectedTeamInstanceId: instance, expectedEnrollmentId: "b".repeat(64), expectedRevision: 0,
    requestId: "ab13a4b5-9a5a-447a-86a4-45051f7a5be1" };
  it("binds team identity to the stored club and full server creation timestamp", () => {
    expect(instance).toMatch(/^[a-f0-9]{64}$/);
    expect(instance).not.toBe(teamInstanceId("team", "other-club", first));
    expect(instance).not.toBe(teamInstanceId("team", "club", second));
    expect(instance).not.toBe(teamInstanceId("other-team", "club", first));
  });
  it("keeps recreated child profiles and member identities in separate enrollment namespaces", () => {
    expect(teamEnrollmentId(instance, "child", "same", first)).not.toBe(teamEnrollmentId(instance, "child", "same", second));
    expect(teamEnrollmentId(instance, "member", "same", null)).not.toBe(teamEnrollmentId(instance, "child", "same", first));
    expect(teamEnrollmentOperationId("parent", request.requestId)).not.toBe(teamEnrollmentOperationId("manager", request.requestId));
  });
  it("requires the displayed team identity, safe revision and an operation UUID without client ownership or approval flags", () => {
    expect(requestTeamEnrollmentSchema.safeParse(request).success).toBe(true);
    for (const patch of [{ expectedTeamInstanceId: "legacy" }, { expectedRevision: -1 }, { expectedRevision: Number.MAX_SAFE_INTEGER },
      { expectedRevision: 0.5 }, { requestId: "bad" }, { userId: "other" }, { clubId: "other" }, { approved: true }, { childId: "a/b" }])
      expect(requestTeamEnrollmentSchema.safeParse({ ...request, ...patch }).success).toBe(false);
    expect(transitionTeamEnrollmentSchema.safeParse({ enrollmentId: "a".repeat(64), action: "approve", expectedRevision: 1,
      requestId: request.requestId, clubId: "spoof" }).success).toBe(false);
  });
  it("fingerprints semantic payloads rather than object key order or operation identities", () => {
    const reordered = { requestId: "cbc0420f-1342-4714-9525-e0913d923c1b", expectedRevision: 0,
      expectedEnrollmentId: "b".repeat(64), expectedTeamInstanceId: instance, teamId: "team" };
    expect(teamEnrollmentFingerprint(reordered)).toBe(teamEnrollmentFingerprint(request));
    expect(teamEnrollmentFingerprint({ ...request, expectedRevision: 1 })).not.toBe(teamEnrollmentFingerprint(request));
    expect(teamEnrollmentFingerprint({ ...request, childId: "child" })).not.toBe(teamEnrollmentFingerprint(request));
  });
  it("never turns a request, replay or closed enrollment into automatic approval", () => {
    expect(nextTeamEnrollmentStatus(undefined, "request")).toBe("requested");
    expect(nextTeamEnrollmentStatus("requested", "approve")).toBe("approved");
    expect(nextTeamEnrollmentStatus("approved", "request")).toBeNull();
    expect(nextTeamEnrollmentStatus("revoked", "approve")).toBeNull();
    expect(nextTeamEnrollmentStatus("refused", "request")).toBe("requested");
    expect(nextTeamEnrollmentStatus("approved", "revoke")).toBe("revoked");
    expect(nextTeamEnrollmentStatus("requested", "withdraw")).toBe("withdrawn");
  });
  it("requires private records to carry exact typed subject provenance and a version", () => {
    const record = { teamId: "team", teamInstanceId: instance, teamCreatedAt: first, clubId: "club", subjectKind: "member",
      subjectId: "parent", childCreatedAt: null, requesterUserId: "parent", status: "requested", revision: 1,
      lastActorUserId: "parent", createdAt: second, updatedAt: second };
    expect(teamEnrollmentRecordSchema.safeParse(record).success).toBe(true);
    for (const patch of [{ revision: 0 }, { requesterUserId: "other" }, { childCreatedAt: first }, { subjectKind: "child" },
      { status: "active" }, { extra: true }]) expect(teamEnrollmentRecordSchema.safeParse({ ...record, ...patch }).success).toBe(false);
  });
});
