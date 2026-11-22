import { describe, expect, it } from "vitest";
import type { Transaction } from "firebase-admin/firestore";
import {currentTeamConversationAccount,teamConversationAccounts} from "../services/teamConversationAccounts.js";
const tx = {} as Transaction;
describe("transaction-attempt current team account authority", () => {
  it("loads an account only once during the same attempt", async () => {
    let calls = 0; const context = teamConversationAccounts(tx, async uid => { calls++; return {uid,disabled:false}; });
    await currentTeamConversationAccount(tx,"parent",context); await currentTeamConversationAccount(tx,"parent",context);
    expect(calls).toBe(1);
  });
  it("does not reuse one account for another recipient", async () => {
    let calls = 0; const context = teamConversationAccounts(tx, async uid => { calls++; return {uid,disabled:false}; });
    expect((await currentTeamConversationAccount(tx,"parent",context)).uid).toBe("parent");
    expect((await currentTeamConversationAccount(tx,"driver",context)).uid).toBe("driver"); expect(calls).toBe(2);
  });
  it("fresh attempts read current claims again rather than retaining a global cache", async () => {
    let claims = ["parent"]; const load = async (uid: string) => ({uid,disabled:false,customClaims:{roleKeys:claims}});
    const first = await currentTeamConversationAccount(tx,"parent",teamConversationAccounts(tx,load)); claims = ["child"];
    const next = await currentTeamConversationAccount(tx,"parent",teamConversationAccounts(tx,load));
    expect(first.customClaims?.roleKeys).toEqual(["parent"]); expect(next.customClaims?.roleKeys).toEqual(["child"]);
  });
  it("rejects mismatched transaction or returned account identities", async () => {
    const context = teamConversationAccounts(tx, async () => ({uid:"other",disabled:false}));
    await expect(currentTeamConversationAccount({} as Transaction,"parent",context)).rejects.toMatchObject({code:"failed-precondition"});
    await expect(currentTeamConversationAccount(tx,"parent",context)).rejects.toMatchObject({code:"failed-precondition"});
  });
  it("rejects disabled and deleted accounts", async () => {
    await expect(currentTeamConversationAccount(tx,"parent",teamConversationAccounts(tx,async uid => ({uid,disabled:true}))))
      .rejects.toMatchObject({code:"permission-denied"});
    await expect(currentTeamConversationAccount(tx,"parent",teamConversationAccounts(tx,async () => { throw {code:"auth/user-not-found"}; })))
      .rejects.toMatchObject({code:"permission-denied"});
  });
  it("propagates account-service failure without a stale account or another transport", async () => {
    let calls = 0; const failure = new Error("Synthetic lookup outage");
    const context = teamConversationAccounts(tx,async () => {calls++; throw failure;});
    for(let i=0;i<2;i++)await expect(currentTeamConversationAccount(tx,"parent",context)).rejects.toBe(failure);
    expect(calls).toBe(1);
  });
});
