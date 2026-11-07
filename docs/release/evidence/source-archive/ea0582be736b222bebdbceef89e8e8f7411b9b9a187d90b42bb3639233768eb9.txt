import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), createUser: vi.fn(), setCustomUserClaims: vi.fn(), updateUser: vi.fn() }));
vi.mock("../lib/firebase.js", () => ({ auth: mocks, firestore: {} }));
import { enableInvitedChildAccount, prepareInvitedChildAccount } from "../services/childInvitationAuth.js";

const uid = "reserved-child", hash = "a".repeat(64), email = "child@example.test", password = "local-test-password";
const missing = () => Object.assign(new Error("Synthetic missing user"), { code: "auth/user-not-found" });
const child = (disabled = true) => ({ uid, email, emailVerified: false, disabled,
  customClaims: { roleKeys: ["child"], childInvitationHash: hash } });
beforeEach(() => { vi.resetAllMocks(); });
describe("invitation Auth provisioning order and failure semantics", () => {
  it("creates a disabled user, writes only child claims, and never enables during preparation", async () => {
    const initial = { uid, email, disabled: true, emailVerified: false, customClaims: undefined };
    mocks.getUser.mockRejectedValueOnce(missing()).mockResolvedValueOnce(child());
    mocks.createUser.mockResolvedValue(initial);
    await prepareInvitedChildAccount(uid, hash, email, password, "Enfant QA");
    expect(mocks.createUser).toHaveBeenCalledWith({ uid, email, password, displayName: "Enfant QA", disabled: true, emailVerified: false });
    expect(mocks.setCustomUserClaims).toHaveBeenCalledWith(uid, { roleKeys: ["child"], childInvitationHash: hash });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.createUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.setCustomUserClaims.mock.invocationCallOrder[0]);
  });
  it("a claims failure cannot enable the account or replace its password", async () => {
    const failure = new Error("Synthetic claims-write failure");
    mocks.getUser.mockResolvedValue({ uid, email, disabled: true, emailVerified: false });
    mocks.setCustomUserClaims.mockRejectedValue(failure);
    await expect(prepareInvitedChildAccount(uid, hash, email, password, "Enfant QA")).rejects.toBe(failure);
    expect(mocks.updateUser).not.toHaveBeenCalled(); expect(mocks.createUser).not.toHaveBeenCalled();
  });
  it("existing adult, foreign invitation, verified-email and unrelated identities cannot be downgraded or adopted", async () => {
    for (const user of [{ ...child(), customClaims: { roleKeys: ["parent"] } },
      { ...child(), customClaims: { roleKeys: ["child"], childInvitationHash: "b".repeat(64) } },
      { ...child(), email: "other@example.test" }, { ...child(), emailVerified: true },
      { ...child(), disabled: false, customClaims: {} }]) {
      mocks.getUser.mockResolvedValue(user);
      await expect(prepareInvitedChildAccount(uid, hash, email, password, "Enfant QA")).rejects.toMatchObject({ code: "failed-precondition" });
      expect(mocks.setCustomUserClaims).not.toHaveBeenCalled(); expect(mocks.updateUser).not.toHaveBeenCalled();
    }
  });
  it("an existing-email error reconciles only the reserved UID and never looks up or changes another account", async () => {
    mocks.getUser.mockRejectedValue(missing());
    mocks.createUser.mockRejectedValue(Object.assign(new Error("Synthetic email conflict"), { code: "auth/email-already-exists" }));
    await expect(prepareInvitedChildAccount(uid, hash, email, password, "Enfant QA")).rejects.toMatchObject({ code: "already-exists" });
    expect(mocks.getUser.mock.calls).toEqual([[uid], [uid]]);
    expect(mocks.setCustomUserClaims).not.toHaveBeenCalled(); expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("a concurrent create reconciles the same pure-child identity without resetting credentials", async () => {
    mocks.getUser.mockRejectedValueOnce(missing()).mockResolvedValueOnce(child());
    mocks.createUser.mockRejectedValue(Object.assign(new Error("Synthetic duplicate UID"), { code: "auth/uid-already-exists" }));
    await prepareInvitedChildAccount(uid, hash, email, password, "Enfant QA");
    expect(mocks.setCustomUserClaims).not.toHaveBeenCalled(); expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("a definitive password rejection is reported without keeping or logging the submitted password", async () => {
    mocks.getUser.mockRejectedValue(missing());
    mocks.createUser.mockRejectedValue(Object.assign(new Error(password), { code: "auth/invalid-password" }));
    await expect(prepareInvitedChildAccount(uid, hash, email, password, "Enfant QA")).rejects.toMatchObject({ code: "invalid-argument" });
    try { await prepareInvitedChildAccount(uid, hash, email, password, "Enfant QA"); }
    catch (error) { expect((error as Error).message).not.toContain(password); }
    expect(mocks.updateUser).not.toHaveBeenCalled(); expect(mocks.setCustomUserClaims).not.toHaveBeenCalled();
  });
  it("the final enabling step verifies child claims and only changes disabled state", async () => {
    mocks.getUser.mockResolvedValue(child());
    await enableInvitedChildAccount(uid, hash, email);
    expect(mocks.updateUser).toHaveBeenCalledExactlyOnceWith(uid, { disabled: false });
    mocks.updateUser.mockClear(); mocks.getUser.mockResolvedValue(child(false));
    await enableInvitedChildAccount(uid, hash, email); expect(mocks.updateUser).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValue({ ...child(), customClaims: { roleKeys: ["parent"] } });
    await expect(enableInvitedChildAccount(uid, hash, email)).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
