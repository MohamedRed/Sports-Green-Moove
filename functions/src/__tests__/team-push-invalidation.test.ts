import {beforeEach,describe,expect,it,vi} from "vitest";
import {Timestamp,type Transaction} from "firebase-admin/firestore";
import {teamPushRegistrationFingerprint,teamPushRegistrationRecordSchema,teamPushTokenId} from "../domain/teamPushRegistration.js";
vi.mock("../lib/firestore.js",()=>({firestore:{collection:(collection:string)=>({doc:(id:string)=>({path:collection+"/"+id})})}}));
import {retireRejectedTeamPushBinding} from "../services/teamPushInvalidation.js";

const at=Timestamp.fromMillis(1000),token="synthetic_"+"T".repeat(80);
const device={schemaVersion:1,userId:"parent",platform:"android" as const,secretHash:"a".repeat(64),revision:3,
  active:true,token,createdAt:at,updatedAt:at,fingerprint:""};
device.fingerprint=teamPushRegistrationFingerprint(device.userId,device);
const binding={installationId:"b".repeat(64),userId:device.userId,revision:device.revision,fingerprint:device.fingerprint};
const owner={installationId:binding.installationId,userId:device.userId,revision:device.revision};
const current={exists:true,data:()=>device},reverse={exists:true,data:()=>owner};
const transaction={getAll:vi.fn(),update:vi.fn(),delete:vi.fn()};
const run=()=>retireRejectedTeamPushBinding(transaction as unknown as Transaction,binding,token,Timestamp.fromMillis(2000));
beforeEach(()=>{vi.resetAllMocks();transaction.getAll.mockResolvedValue([current,reverse]);});
describe("invalid team push binding retirement",()=>{
  it("atomically removes only the current token index and preserves a valid revision tombstone",async()=>{
    await run();
    expect(transaction.getAll).toHaveBeenCalledExactlyOnceWith({path:"teamPushInstallations/"+binding.installationId},
      {path:"teamPushTokens/"+teamPushTokenId(token)});
    expect(transaction.update).toHaveBeenCalledTimes(1);
    const patch=transaction.update.mock.calls[0][1];
    expect(patch).toEqual({active:false,token:null,updatedAt:Timestamp.fromMillis(2000),
      fingerprint:teamPushRegistrationFingerprint(device.userId,{...device,token:null})});
    expect(teamPushRegistrationRecordSchema.parse({...device,...patch})).toMatchObject({revision:3,secretHash:device.secretHash,createdAt:at});
    expect(transaction.delete).toHaveBeenCalledExactlyOnceWith({path:"teamPushTokens/"+teamPushTokenId(token)});
  });
  for(const change of [{userId:"other"},{revision:4},{fingerprint:"f".repeat(64)},
    {token:token+"x"},{active:false,token:null}])
    it("does not mutate a replacement binding: "+Object.keys(change).join(","),async()=>{
      transaction.getAll.mockResolvedValue([{exists:true,data:()=>({...device,...change})},reverse]);
      await run();expect(transaction.update).not.toHaveBeenCalled();expect(transaction.delete).not.toHaveBeenCalled();
    });
  it("does not recreate a missing installation",async()=>{
    transaction.getAll.mockResolvedValue([{exists:false},reverse]);await run();
    expect(transaction.update).not.toHaveBeenCalled();expect(transaction.delete).not.toHaveBeenCalled();
  });
  for(const change of [{userId:"other"},{revision:4},{installationId:"c".repeat(64)}])
    it("fails closed without deleting a conflicting reverse owner: "+Object.keys(change)[0],async()=>{
      transaction.getAll.mockResolvedValue([current,{exists:true,data:()=>({...owner,...change})}]);
      await expect(run()).rejects.toThrow(/token identity requires review/);
      expect(transaction.update).not.toHaveBeenCalled();expect(transaction.delete).not.toHaveBeenCalled();
    });
  it("fails closed if the current reverse owner is missing",async()=>{
    transaction.getAll.mockResolvedValue([current,{exists:false}]);await expect(run()).rejects.toThrow(/token identity requires review/);
    expect(transaction.update).not.toHaveBeenCalled();expect(transaction.delete).not.toHaveBeenCalled();
  });
  it("checks stored identity rather than trusting the delivery fingerprint",async()=>{
    const corrupted={...device,fingerprint:"f".repeat(64)};
    transaction.getAll.mockResolvedValue([{exists:true,data:()=>corrupted},reverse]);
    await expect(retireRejectedTeamPushBinding(transaction as unknown as Transaction,
      {...binding,fingerprint:corrupted.fingerprint},token,at)).rejects.toThrow(/device identity requires review/);
    expect(transaction.update).not.toHaveBeenCalled();expect(transaction.delete).not.toHaveBeenCalled();
  });
});
