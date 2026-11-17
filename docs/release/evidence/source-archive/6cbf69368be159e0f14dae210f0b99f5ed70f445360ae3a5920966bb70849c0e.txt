import {afterEach,describe,expect,it,vi} from "vitest";
import {Timestamp} from "firebase-admin/firestore";
import {teamPushDeliverySchema,teamPushDispatchDecision,teamPushLifetimeMs,teamPushOutboxSchema,
  teamPushRecipientSchema} from "../domain/teamPushDispatch.js";
const mocks=vi.hoisted(()=>({send:vi.fn(),projectId:"sports-green-moove-test"}));
vi.mock("firebase-admin/app",()=>({getApp:()=>({options:{projectId:mocks.projectId}})}));
vi.mock("firebase-admin/messaging",()=>({getMessaging:()=>({send:mocks.send})}));
import {sendTeamPush,teamPushProviderFailure} from "../services/teamPushProvider.js";

afterEach(()=>{vi.unstubAllEnvs();mocks.send.mockReset();mocks.projectId="sports-green-moove-test";});
const at=Timestamp.fromMillis(1_000_000),id="a".repeat(64);
const row={userId:"parent",installationId:id,revision:1,fingerprint:id,status:"queued" as const,
  attempts:0,createdAt:at,updatedAt:at};
describe("durable team push dispatch",()=>{
  it("accepts only bounded unique frozen recipients without caller content",()=>{
    const input={schemaVersion:1,status:"pending",messageId:id,teamId:"team",teamInstanceId:id,recipientUserIds:["parent"],createdAt:at};
    expect(teamPushOutboxSchema.parse(input)).toEqual(input);
    for(const change of [{recipientUserIds:[]},{recipientUserIds:["parent","parent"]},
      {recipientUserIds:Array.from({length:497},(_,i)=>"u"+i)},{body:"private"},{messageId:id+"\n"},{status:"sent"}])
      expect(teamPushOutboxSchema.safeParse({...input,...change}).success).toBe(false);
  });
  it("requires an explicit device snapshot for planned and completed recipients",()=>{
    for(const status of ["planned","complete"]){
      expect(teamPushRecipientSchema.safeParse({userId:"parent",status,createdAt:at}).success).toBe(false);
      expect(teamPushRecipientSchema.safeParse({userId:"parent",status,deliveryIds:[],createdAt:at}).success).toBe(true);
    }
  });
  it("allows a fresh claim but never reclaims a live lease",()=>{
    expect(teamPushDispatchDecision(row,at,at.toMillis())).toBe("send");
    expect(teamPushDispatchDecision({...row,status:"sending",leaseUntil:Timestamp.fromMillis(at.toMillis()+100)},at,at.toMillis())).toBe("busy");
  });
  it("expired leases may replay an uncertain attempt, but never imply exactly-once delivery",()=>{
    expect(teamPushDispatchDecision({...row,status:"sending",attempts:1,leaseUntil:at},at,at.toMillis()+1)).toBe("send");
  });
  it("does not send expired alerts or exhausted attempts",()=>{
    expect(teamPushDispatchDecision(row,at,at.toMillis()+teamPushLifetimeMs)).toBe("expired");
    expect(teamPushDispatchDecision({...row,attempts:5},at,at.toMillis())).toBe("exhausted");
  });
  for(const status of ["accepted","suppressed","invalid_token","failed"] as const)
    it("never replays terminal "+status,()=>{
      expect(teamPushDispatchDecision({...row,status},at,at.toMillis()+teamPushLifetimeMs+1)).toBe("done");
    });
  it("rejects raw tokens, secrets, message content and unknown outcomes in persisted attempts",()=>{
    for(const change of [{token:"private"},{installationSecret:id},{body:"private"},{status:"delivered"},{attempts:6}])
      expect(teamPushDeliverySchema.safeParse({...row,...change}).success).toBe(false);
  });
});
describe("provider boundary",()=>{
  it("sends only the opaque data envelope with bounded Android lifetime, never a tray payload",async()=>{
    mocks.send.mockResolvedValue("projects/test/messages/synthetic");
    expect(await sendTeamPush("synthetic-device-token","teamChat_"+id,12_000)).toEqual({status:"accepted",providerId:"projects/test/messages/synthetic"});
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith({token:"synthetic-device-token",data:{type:"teamMessage",notificationId:"teamChat_"+id},
      android:{priority:"high",ttl:12_000}});
  });
  for(const [key,value]of [["FUNCTIONS_EMULATOR","true"],["FIRESTORE_EMULATOR_HOST","localhost:8080"],
    ["FIREBASE_AUTH_EMULATOR_HOST","localhost:9099"]])
    it("refuses real transport when "+key+" is set",async()=>{
      vi.stubEnv(key,value);await expect(sendTeamPush("never-sent","teamChat_"+id,1000)).rejects.toThrow(/disabled/);
      expect(mocks.send).not.toHaveBeenCalled();
    });
  it("refuses a demo namespace even outside emulator process flags",async()=>{
    mocks.projectId="demo-sgm-local-qa";await expect(sendTeamPush("never-sent","teamChat_"+id,1000)).rejects.toThrow(/disabled/);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  for(const [code,reason]of [["messaging/registration-token-not-registered","invalid_token"],
    ["messaging/invalid-registration-token","invalid_token"],["messaging/mismatched-credential","configuration"],
    ["messaging/server-unavailable","temporary"],["messaging/quota-exceeded","temporary"],["unrecognized-private-error","unknown"]])
    it("retains only an allowlisted outcome for "+code,()=>{
      expect(teamPushProviderFailure(code)).toEqual({status:"rejected",reason});
    });
  it("never exposes provider exception text or token fields",async()=>{
    mocks.send.mockRejectedValue({code:"unknown",message:"secret token and private payload",token:"private"});
    expect(await sendTeamPush("never-retained","teamChat_"+id,1000)).toEqual({status:"rejected",reason:"unknown"});
  });
});
