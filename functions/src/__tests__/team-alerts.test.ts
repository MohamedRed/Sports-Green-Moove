import {describe,expect,it} from "vitest";
import {Timestamp} from "firebase-admin/firestore";
import {teamAlertBody,teamAlertId,teamAlertSchema,teamAlertTitle,teamAlertRecipientLimit} from "../domain/teamConversationAlerts.js";

describe("team alert privacy and identity",()=>{
  const messageId="a".repeat(64),at=new Timestamp(123,456);
  const value={type:"teamMessage",userId:"parent",teamId:"team",teamInstanceId:"b".repeat(64),messageId,
    title:teamAlertTitle,body:teamAlertBody,createdAt:at,messageCreatedAt:at,read:false};
  it("binds each alert to one message and recipient without message content",()=>{
    expect(teamAlertId(messageId,"parent")).toBe(teamAlertId(messageId,"parent"));
    expect(teamAlertId(messageId,"parent")).not.toBe(teamAlertId(messageId,"other"));
    expect(teamAlertId(messageId,"parent")).toMatch(/^teamChat_[a-f0-9]{64}$/);
    expect(teamAlertSchema.parse(value)).toEqual(value);
    expect(teamAlertRecipientLimit+4).toBe(500);
  });
  it("rejects content-bearing, malformed or uncommitted notification metadata",()=>{
    for(const change of [{body:"A private team message"},{title:"Private team identity"},{messageCreatedAt:0},
      {createdAt:null},{userId:"other/user"},{teamInstanceId:"old"},{messageId:""},{read:"false"}])
      expect(teamAlertSchema.safeParse({...value,...change}).success).toBe(false);
  });
});
