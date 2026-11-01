import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Timestamp} from 'firebase-admin/firestore';
import {deleteApp} from 'firebase-admin/app';
import {seedLocalUiFixtures} from './local-ui-fixtures.mjs';
import {auth,db,call,denied} from './local-flow-client.mjs';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';
import {prepareTeamAlertFixture} from './team-alert-fixture.mjs';
import {teamPushAlertSources} from './team-push-alert-sources.mjs';
const {teamPushInstallationId,teamPushTokenId}=await import('../../functions/lib/domain/teamPushRegistration.js');
const fresh=()=>({installationId:randomUUID(),installationSecret:randomBytes(32).toString('hex'),revision:1,
  platform:'android',token:'synthetic_token_'+randomBytes(48).toString('hex')});
const steps=[],passed=id=>steps.push({id,status:'passed'});
let adminClientClosed=false,firestoreClientTerminated=false,protectedBaselinePreserved=false;
await withLocalAdminCleanup(async()=>{
  await seedLocalUiFixtures();const f=await prepareTeamAlertFixture(),{parent,driver,otherAdult}=f.actors;
  const baseline=new Map();for(const collection of await db.listCollections())for(const row of (await collection.get()).docs)
    baseline.set(row.ref.path,row.data());
  const originalUsers=(await auth.listUsers(1000)).users.map(row=>({uid:row.uid,claims:row.customClaims??{},disabled:row.disabled}));
  let device=fresh();await call('registerTeamPushDevice',parent,device);
  const other=fresh();await call('registerTeamPushDevice',otherAdult,other);
  const installation=db.collection('teamPushInstallations').doc(teamPushInstallationId(device.installationId));
  const entries=db.collection('teamConversations').doc(f.target.expectedTeamInstanceId).collection('entries');
  const send=async()=>{
    const message=await call('sendTeamChatMessage',driver,{...f.target,body:'Message privé isolé QA',clientMessageId:randomUUID()});
    return (await db.collection('teamChatNotifications').where('userId','==',parent.uid).get()).docs
      .find(row=>row.get('messageId')===message.messageId);
  };
  const notice=await send();assert(notice);
  const request=(row=notice,purpose='display',binding=device)=>({installationId:binding.installationId,
    installationSecret:binding.installationSecret,revision:binding.revision,notificationId:row.id,purpose});
  const resolveAlert=(row=notice,purpose='display')=>call('resolveTeamPushAlert',parent,request(row,purpose));
  const suppressed=async(row=notice)=>{
    for(const purpose of ['display','open'])assert.deepEqual(await resolveAlert(row,purpose),{status:'suppressed'});
  };
  const expected=row=>({status:'available',notificationId:row.id,title:'Nouveau message d’équipe',
    body:'Un nouveau message est disponible dans votre équipe.',target:f.target});
  await denied('resolveTeamPushAlert',null,request(),'UNAUTHENTICATED');
  for(const extra of [{userId:driver.uid},{target:f.target},{body:'Contenu choisi QA'},{purpose:'read'}])
    await denied('resolveTeamPushAlert',parent,{...request(),...extra},'INVALID_ARGUMENT');
  passed('authentication-and-strict-request-reject-caller-selected-owner-content-and-route');
  const records=await Promise.all([notice.ref.get(),installation.get(),entries.get(),entries.parent.collection('readReceipts').get()]);
  const resolved=await Promise.all([resolveAlert(),resolveAlert(notice,'open'),resolveAlert()]);
  for(const result of resolved)assert.deepEqual(result,expected(notice));
  assert(!JSON.stringify(resolved).includes('Message privé isolé QA'));
  assert.deepEqual((await notice.ref.get()).data(),records[0].data());
  assert.deepEqual((await installation.get()).data(),records[1].data());
  assert.deepEqual((await entries.get()).docs.map(row=>row.data()),records[2].docs.map(row=>row.data()));
  assert.deepEqual((await entries.parent.collection('readReceipts').get()).docs,records[3].docs);
  passed('display-and-open-return-only-generic-copy-and-current-team-reference-without-reads-or-writes');
  await denied('resolveTeamPushAlert',parent,{...request(),installationSecret:'f'.repeat(64)},'PERMISSION_DENIED');
  await denied('resolveTeamPushAlert',parent,{...request(),installationId:randomUUID()},'PERMISSION_DENIED');
  await denied('resolveTeamPushAlert',parent,{...request(),revision:2},'PERMISSION_DENIED');
  await denied('resolveTeamPushAlert',otherAdult,request(),'PERMISSION_DENIED');
  passed('unknown-installation-wrong-proof-stale-revision-and-foreign-device-owner-are-denied');
  assert.deepEqual(await call('resolveTeamPushAlert',otherAdult,request(notice,'display',other)),{status:'suppressed'});
  assert.deepEqual(await call('resolveTeamPushAlert',parent,{...request(),notificationId:'teamChat_'+'0'.repeat(64)}),{status:'suppressed'});
  passed('foreign-alert-and-missing-alert-have-identical-empty-responses');
  await call('markNotificationRead',parent,{userId:parent.uid,notificationId:notice.id});
  assert.deepEqual(await resolveAlert(),{status:'suppressed'});
  assert.deepEqual(await resolveAlert(notice,'open'),expected(notice));
  assert.equal((await entries.parent.collection('readReceipts').get()).size,0);
  passed('read-alert-is-not-redisplayed-but-authorized-open-remains-possible-without-message-acknowledgement');
  const unread=await send();assert(unread);
  const previous=device;device={...device,revision:2,token:device.token+'rotated'};
  await call('registerTeamPushDevice',parent,device);
  await denied('resolveTeamPushAlert',parent,request(unread,'open',previous),'PERMISSION_DENIED');
  assert.deepEqual(await resolveAlert(unread,'open'),expected(unread));
  passed('token-rotation-rejects-old-attempt-but-current-revision-can-resolve-an-existing-opaque-alert');
  await call('registerTeamPushDevice',otherAdult,{...device,revision:3});
  await denied('resolveTeamPushAlert',parent,request(unread),'PERMISSION_DENIED');
  assert.deepEqual(await call('resolveTeamPushAlert',otherAdult,request(unread,'display',{...device,revision:3})),{status:'suppressed'});
  device={...device,revision:4};await call('registerTeamPushDevice',parent,device);
  assert.deepEqual(await resolveAlert(unread),expected(unread));
  passed('account-switch-rejects-the-old-owner-and-cannot-expose-that-owners-alert-to-the-new-account');
  await call('registerTeamPushDevice',parent,{...device,revision:5,token:null});
  await denied('resolveTeamPushAlert',parent,request(unread),'PERMISSION_DENIED');
  await denied('resolveTeamPushAlert',parent,request(unread,'open',{...device,revision:5}),'PERMISSION_DENIED');
  device={...device,revision:6};await call('registerTeamPushDevice',parent,device);
  passed('signout-tombstone-blocks-both-stale-and-current-revision-resolution-until-explicit-registration');
  const token=db.collection('teamPushTokens').doc(teamPushTokenId(device.token)),validToken=(await token.get()).data();
  for(const change of [null,{...validToken,revision:5},{...validToken,userId:driver.uid},
    {...validToken,installationId:'b'.repeat(64)},{...validToken,extra:'unrecognized'}]){
    if(change===null)await token.delete();else await token.set(change);
    await denied('resolveTeamPushAlert',parent,request(unread),'FAILED_PRECONDITION');
  }
  await token.set(validToken);
  const validDevice=(await installation.get()).data();
  for(const change of [{...validDevice,fingerprint:'f'.repeat(64)},{...validDevice,active:false},
    {...validDevice,updatedAt:null},{...validDevice,installationSecret:device.installationSecret}]){
    await installation.set(change);await denied('resolveTeamPushAlert',parent,request(unread),'FAILED_PRECONDITION');
  }
  await installation.set(validDevice);
  passed('missing-conflicting-or-malformed-token-index-and-corrupt-registration-fail-closed');
  const parentClaims=(await auth.getUser(parent.uid)).customClaims;
  try{await auth.setCustomUserClaims(parent.uid,{roleKeys:['parent','child']});
    await denied('resolveTeamPushAlert',parent,request(unread),'PERMISSION_DENIED');}
  finally{await auth.setCustomUserClaims(parent.uid,parentClaims);}
  try{await auth.updateUser(parent.uid,{disabled:true});
    await denied('resolveTeamPushAlert',parent,request(unread),'PERMISSION_DENIED');}
  finally{await auth.updateUser(parent.uid,{disabled:false});}
  const profile=db.collection('users').doc(parent.uid),validProfile=(await profile.get()).data();
  try{await profile.update({'roles.child':true});await denied('resolveTeamPushAlert',parent,request(unread),'PERMISSION_DENIED');}
  finally{await profile.set(validProfile);}
  const childLogin=db.collection('childAccountLinks').doc(parent.uid);
  try{await childLogin.create({accountUserId:parent.uid,childId:f.childId,status:'verified'});
    await denied('resolveTeamPushAlert',parent,request(unread),'PERMISSION_DENIED');}
  finally{await childLogin.delete();}
  passed('current-child-claims-disabled-state-child-profile-and-child-link-override-a-stale-adult-login');
  const validAlert=(await unread.ref.get()).data(),message=entries.doc(validAlert.messageId),validMessage=(await message.get()).data();
  for(const change of [{...validAlert,messageCreatedAt:Timestamp.fromMillis(0)},
    {...validAlert,messageId:'c'.repeat(64)},{...validAlert,title:'Texte privé QA'}]){
    await unread.ref.set(change);await denied('resolveTeamPushAlert',parent,request(unread),'FAILED_PRECONDITION');
  }
  await unread.ref.set(validAlert);await message.delete();await suppressed(unread);await message.set(validMessage);
  await message.update({senderUserId:parent.uid});
  await denied('resolveTeamPushAlert',parent,request(unread),'FAILED_PRECONDITION');await message.set(validMessage);
  passed('forged-alert-identity-private-copy-missing-message-and-self-message-never-resolve');
  await f.guardian(parent,'revoke',2);await suppressed(unread);
  await f.guardian(parent,'request',3);await f.guardian(parent,'verify',4);await suppressed(unread);
  const later=await send();assert(later);assert.deepEqual(await resolveAlert(later),expected(later));
  passed('guardian-revocation-suppresses-both-purposes-and-new-verification-cannot-recover-old-history');
  const membership=db.collection('memberships').doc(parent.uid+'_'+f.clubId),validMembership=(await membership.get()).data();
  await membership.update({status:'inactive'});await suppressed(later);await membership.set(validMembership);
  const childMembership=db.collection('memberships').doc(f.childId+'_'+f.clubId),validChildMembership=(await childMembership.get()).data();
  await childMembership.update({status:'inactive'});await suppressed(later);await childMembership.set(validChildMembership);
  passed('adult-and-child-current-club-memberships-are-rechecked-before-display-and-open');
  await call('transitionTeamEnrollment',f.actors.manager,{enrollmentId:f.childEnrollment.view.id,action:'revoke',
    expectedRevision:f.childEnrollment.approved.revision,requestId:randomUUID()});
  await suppressed(later);await f.enroll(parent,f.childId);await suppressed(later);
  const newest=await send();assert(newest);assert.deepEqual(await resolveAlert(newest),expected(newest));
  passed('manager-revocation-and-reapproval-start-a-new-history-boundary');
  const team=db.collection('teams').doc(f.teamId);await team.update({status:'inactive'});await suppressed(newest);
  await team.delete();await team.create({clubId:f.clubId,name:'Equipe recréée QA',status:'active'});await suppressed(newest);
  passed('closed-or-recreated-team-never-resolves-a-previous-instance-alert');
  const owned=new Set([team.path,`guardianVerifications/${f.parentVerificationId}`,`teamEnrollments/${f.childEnrollment.view.id}`]);
  for(const [path,data]of baseline)if(!owned.has(path))assert.deepEqual((await db.doc(path).get()).data(),data,path);
  assert.deepEqual((await auth.listUsers(1000)).users.map(row=>({uid:row.uid,claims:row.customClaims??{},disabled:row.disabled})),originalUsers);
  assert.equal((await entries.parent.collection('readReceipts').get()).size,0);
  assert.equal((await db.collection('teamPushOutbox').get()).docs.every(row=>row.get('status')==='pending'),true);
  protectedBaselinePreserved=true;passed('unrelated-fixtures-and-accounts-are-unchanged-no-message-receipts-or-provider-sends');
},{firestore:{terminate:async()=>{await db.terminate();firestoreClientTerminated=true;}},
  closeApp:async app=>{await deleteApp(app);adminClientClosed=true;}});
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT,JSON.stringify({projectId:'demo-sgm-local-qa',runId:process.env.SGM_LOCAL_RUN_ID,
  testedAt:new Date().toISOString(),scope:'isolated-alert-authorization-not-native-display-or-provider-delivery',completed:true,steps,
  isolation:{protectedBaselinePreserved},adminClientClosed,firestoreClientTerminated,
  physicalDevice:false,nativeUiExecuted:false,pushDeliveryVerified:false,realPhoneTokenRegistered:false,
  providerRequests:0,productionWrites:false,mapRequests:0,realPayments:false,
  sourceFiles:Object.fromEntries(teamPushAlertSources.map(file=>[file,createHash('sha256')
    .update(readFileSync(resolve(import.meta.dirname,'../..',file))).digest('hex')]))},null,2)+'\n',{flag:'wx'});
console.log(`Passed ${steps.length} isolated alert-authorization cases; no native display, tap or delivery accepted.`);
