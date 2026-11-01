import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {deleteApp} from 'firebase-admin/app';
import {seedLocalUiFixtures} from './local-ui-fixtures.mjs';
import {auth,db,call,denied,signIn} from './local-flow-client.mjs';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';
import {prepareTeamAlertFixture} from './team-alert-fixture.mjs';
import {fetchLocalQa} from './local-http-request.mjs';
import {teamPushRegistrationSources} from './team-push-registration-sources.mjs';
const {teamPushInstallationId,teamPushTokenId}=await import('../../functions/lib/domain/teamPushRegistration.js');

const steps=[],passed=id=>steps.push({id,status:'passed'});
const fresh=()=>({installationId:randomUUID(),installationSecret:randomBytes(32).toString('hex'),revision:1,
  platform:'android',token:'synthetic_token_'+randomBytes(48).toString('hex')});
let adminClientClosed=false,firestoreClientTerminated=false,protectedBaselinePreserved=false;
await withLocalAdminCleanup(async()=>{
  await seedLocalUiFixtures();const f=await prepareTeamAlertFixture(),{parent,driver,otherAdult}=f.actors;
  const baseline=new Map();for(const collection of await db.listCollections())for(const row of (await collection.get()).docs)
    baseline.set(row.ref.path,row.data());
  const users=async()=>(await auth.listUsers(1000)).users.map(row=>({uid:row.uid,claims:row.customClaims??{},disabled:row.disabled}));
  const originalUsers=await users(),device=fresh(),name='registerTeamPushDevice';
  const ref=db.collection('teamPushInstallations').doc(teamPushInstallationId(device.installationId));
  await denied(name,null,device,'UNAUTHENTICATED');
  await denied(name,parent,{...device,userId:driver.uid},'INVALID_ARGUMENT');
  passed('authentication-and-unknown-owner-field-are-rejected');
  const results=await Promise.all([call(name,parent,device),call(name,parent,device)]);
  assert.deepEqual(results.map(row=>row.reused).sort(),[false,true]);
  for(const result of results)assert.deepEqual(Object.keys(result).sort(),['active','currentUserId','reused','revision']);
  assert.equal((await db.collection('teamPushTokens').get()).size,1);
  const stored=(await ref.get()).data();assert(!('installationSecret' in stored));assert.equal(stored.userId,parent.uid);
  assert.notEqual(stored.secretHash,device.installationSecret);
  passed('concurrent-identical-registration-creates-one-private-binding-without-returning-token-or-proof');
  await denied(name,driver,{...device,installationSecret:'b'.repeat(64),revision:2},'PERMISSION_DENIED');
  assert.deepEqual((await ref.get()).data(),stored);
  passed('another-account-cannot-take-a-known-installation-without-its-proof');
  await denied(name,parent,{...device,token:device.token+'changed'},'ABORTED');
  const rotated={...device,revision:2,token:device.token+'rotated'};await call(name,parent,rotated);
  assert.equal((await db.collection('teamPushTokens').doc(teamPushTokenId(device.token)).get()).exists,false);
  assert.equal((await db.collection('teamPushTokens').doc(teamPushTokenId(rotated.token)).get()).get('revision'),2);
  await denied(name,parent,device,'ABORTED');
  passed('token-rotation-removes-old-index-and-rejects-reordered-or-conflicting-updates');
  const race=fresh();await call(name,parent,race);
  const raced=await Promise.allSettled([call(name,parent,{...race,revision:3,token:race.token+'third'}),
    call(name,parent,{...race,revision:2,token:race.token+'second'})]);
  assert.equal(raced[0].status,'fulfilled');
  if(raced[1].status==='rejected')assert.equal(raced[1].reason.code,'ABORTED');
  const raceRef=db.collection('teamPushInstallations').doc(teamPushInstallationId(race.installationId));
  assert.equal((await raceRef.get()).get('revision'),3);assert.equal((await raceRef.get()).get('token'),race.token+'third');
  assert.equal((await db.collection('teamPushTokens').doc(teamPushTokenId(race.token+'second')).get()).exists,false);
  passed('concurrent-out-of-order-revisions-converge-on-the-newest-token-only');
  await denied(name,driver,{...fresh(),token:rotated.token},'ALREADY_EXISTS');
  passed('a-token-cannot-be-copied-into-another-installation');
  const transferred={...rotated,revision:3};await call(name,driver,transferred);
  assert.equal((await ref.get()).get('userId'),driver.uid);
  await denied(name,parent,rotated,'ABORTED');
  await denied(name,parent,{...rotated,revision:4,token:null},'PERMISSION_DENIED');
  assert.equal((await ref.get()).get('userId'),driver.uid);
  passed('account-switch-transfers-one-binding-and-old-account-cannot-replay-or-remove-it');
  const unrelatedTokens=(await db.collection('teamPushTokens').get()).docs.filter(row=>row.id!==teamPushTokenId(rotated.token))
    .map(row=>({id:row.id,...row.data()}));
  const removed={...transferred,revision:4,token:null};await call(name,driver,removed);
  assert.equal((await ref.get()).get('active'),false);assert.equal((await ref.get()).get('token'),null);
  assert.deepEqual((await db.collection('teamPushTokens').get()).docs.map(row=>({id:row.id,...row.data()})),unrelatedTokens);
  assert.equal((await call(name,driver,removed)).reused,true);
  await denied(name,driver,transferred,'ABORTED');
  passed('signout-removal-leaves-a-revision-tombstone-and-delayed-registration-cannot-revive-it');
  await call(name,parent,{...device,revision:5});
  assert.equal((await ref.get()).get('userId'),parent.uid);
  const empty=fresh();await call(name,parent,{...empty,token:null});
  await denied(name,parent,empty,'ABORTED');
  passed('newer-signin-is-explicit-and-removal-before-first-token-also-prevents-delayed-activation');
  const mixed=await signIn('mixed-team-alert@example.test');
  for(const actor of [mixed,f.actors.linked,f.actors.childProfile,f.actors.disabled])await denied(name,actor,fresh(),'PERMISSION_DENIED');
  passed('mixed-child-claims-linked-child-login-child-profile-and-disabled-account-cannot-register');
  await denied(name,f.actors.mixed,fresh(),'PERMISSION_DENIED');
  passed('current-child-claims-deny-a-still-valid-earlier-adult-login');
  const sent=await call('sendTeamChatMessage',driver,{...f.target,body:'Message de contrôle des accès QA',clientMessageId:randomUUID()});
  const notice=(await call('getNotificationInbox',parent)).notifications.find(row=>row.id.startsWith('teamChat_'));assert(notice);
  const parentClaims=(await auth.getUser(parent.uid)).customClaims;
  const verifyDenied=async()=>{
    await denied('getTeamChatMessages',parent,f.target,'PERMISSION_DENIED');
    await denied('listTeamChatOptions',parent,{kind:'clubs'},'PERMISSION_DENIED');
    await denied('sendTeamChatMessage',parent,{...f.target,body:'Ne doit pas être envoyé QA',clientMessageId:randomUUID()},'PERMISSION_DENIED');
    await denied('markNotificationRead',parent,{userId:parent.uid,notificationId:notice.id},'NOT_FOUND');
    assert(!(await call('getNotificationInbox',parent)).notifications.some(row=>row.id===notice.id));
  };
  try{await auth.setCustomUserClaims(parent.uid,{roleKeys:['parent','child']});await verifyDenied();}
  finally{await auth.setCustomUserClaims(parent.uid,parentClaims);}
  passed('stale-adult-login-cannot-list-read-send-or-acknowledge-after-current-child-claims');
  try{await auth.updateUser(parent.uid,{disabled:true});await verifyDenied();}
  finally{await auth.updateUser(parent.uid,{disabled:false});}
  const teamRoot=db.collection('teamConversations').doc(f.target.expectedTeamInstanceId);
  assert.equal((await teamRoot.collection('entries').get()).size,1);assert.equal((await teamRoot.collection('entries').doc(sent.messageId).get()).exists,true);
  assert.equal((await teamRoot.collection('readReceipts').get()).size,0);
  assert.equal((await db.collection('teamChatNotifications').get()).size,2);assert.equal((await db.collection('teamPushOutbox').get()).size,1);
  passed('disabled-account-with-valid-earlier-login-cannot-use-team-history-or-write-messages');
  const publicUrl=collection=>`http://127.0.0.1:8080/v1/projects/demo-sgm-local-qa/databases/(default)/documents/${collection}`;
  for(const [collection,id]of [['teamPushInstallations',ref.id],['teamPushTokens',teamPushTokenId(device.token)]]){
    for(const actor of [parent,driver]){
      const headers={authorization:`Bearer ${actor.token}`};
      assert.equal((await fetchLocalQa(publicUrl(collection)+'/'+id,{headers})).status,403);
      assert.equal((await fetchLocalQa(publicUrl(collection),{headers})).status,403);
    }
  }
  passed('private-registration-and-token-index-cannot-be-read-or-listed-by-client-accounts');
  const two=fresh(),three=fresh();await call(name,parent,two);await call(name,parent,three);
  await call(name,parent,{...two,revision:2,token:null});
  assert.equal((await db.collection('teamPushInstallations').doc(teamPushInstallationId(three.installationId)).get()).get('active'),true);
  passed('removing-one-device-does-not-disable-other-devices');
  for(let i=0;i<20;i++)await call(name,otherAdult,fresh());
  await denied(name,otherAdult,fresh(),'RESOURCE_EXHAUSTED');
  assert.equal((await db.collection('teamPushInstallations').where('userId','==',otherAdult.uid).where('active','==',true).get()).size,20);
  passed('active-device-limit-rejects-without-an-extra-token-or-binding');
  const tokenRef=db.collection('teamPushTokens').doc(teamPushTokenId(device.token));
  const tokenRecord=(await tokenRef.get()).data();await tokenRef.delete();
  await denied(name,parent,{...device,revision:6},'FAILED_PRECONDITION');
  await denied(name,parent,{...device,revision:5},'FAILED_PRECONDITION');await tokenRef.set(tokenRecord);
  assert.equal((await ref.get()).get('revision'),5);
  passed('missing-token-index-fails-closed-without-rewriting-the-registration');
  const valid=(await ref.get()).data();await ref.update({fingerprint:'f'.repeat(64)});
  await denied(name,parent,{...device,revision:6},'FAILED_PRECONDITION');await ref.set(valid);
  passed('corrupt-registration-fingerprint-cannot-be-promoted-by-a-new-revision');
  for(const [path,row]of baseline)assert.deepEqual((await db.doc(path).get()).data(),row,path);
  passed('all-original-records-account-claims-and-disabled-states-remain-unchanged');
  assert.deepEqual(await users(),originalUsers);protectedBaselinePreserved=true;
},{firestore:{terminate:async()=>{await db.terminate();firestoreClientTerminated=true;}},closeApp:async app=>{await deleteApp(app);adminClientClosed=true;}});
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT,JSON.stringify({projectId:'demo-sgm-local-qa',runId:process.env.SGM_LOCAL_RUN_ID,
  testedAt:new Date().toISOString(),scope:'isolated-server-device-registration-not-native-or-push-delivery',completed:true,steps,
  isolation:{protectedBaselinePreserved},adminClientClosed,firestoreClientTerminated,physicalDevice:false,nativeUiExecuted:false,
  pushDeliveryVerified:false,realPhoneTokenRegistered:false,providerRequests:0,productionWrites:false,mapRequests:0,realPayments:false,
  sourceFiles:Object.fromEntries(teamPushRegistrationSources.map(file=>[file,createHash('sha256').update(readFileSync(resolve(import.meta.dirname,'../..',file))).digest('hex')]))
},null,2)+'\n',{flag:'wx'});
console.log(`Passed ${steps.length} isolated device-registration cases; no real phone or push delivery accepted.`);
