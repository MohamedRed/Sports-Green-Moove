import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {deleteApp} from 'firebase-admin/app';
import {seedLocalUiFixtures} from './local-ui-fixtures.mjs';
import {auth,db,call,denied} from './local-flow-client.mjs';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';
import {prepareTeamAlertFixture} from './team-alert-fixture.mjs';

const steps=[],passed=id=>steps.push({id,status:'passed'});
let protectedBaselinePreserved=false,adminClientClosed=false,firestoreClientTerminated=false;
await withLocalAdminCleanup(async()=>{
  await seedLocalUiFixtures();const f=await prepareTeamAlertFixture(),{parent,driver,manager,otherAdult}=f.actors;
  const baseline=new Map();for(const collection of await db.listCollections())for(const row of(await collection.get()).docs)
    baseline.set(row.ref.path,row.data());
  const claims=(await auth.listUsers(1000)).users.map(user=>({uid:user.uid,claims:user.customClaims??{},disabled:user.disabled}));
  const inbox=actor=>call('getNotificationInbox',actor);
  const initial=await inbox(parent);assert.equal(initial.userId,parent.uid);
  assert.deepEqual(initial.notifications,(await call('getInbox',parent)).inbox.notifications);
  await denied('getNotificationInbox',null,{},'UNAUTHENTICATED');
  await denied('getNotificationInbox',parent,{userId:driver.uid},'INVALID_ARGUMENT');
  await denied('getNotificationInbox',parent,{cursor:'foreign'},'INVALID_ARGUMENT');
  passed('authenticated-notification-only-read-preserves-existing-alerts-and-rejects-owner-injection');
  const send=(actor,body)=>call('sendTeamChatMessage',actor,{...f.target,body,clientMessageId:randomUUID()});
  const message=await send(driver,'Texte privé QA jamais envoyé au lecteur des alertes.');
  const note=(await db.collection('teamChatNotifications').where('messageId','==',message.messageId).get()).docs.find(row=>row.get('userId')===parent.uid);
  const current=await inbox(parent),received=current.notifications.find(row=>row.id===note.id);
  assert.equal(received.unread,true);assert.equal(received.title,'Nouveau message d’équipe');
  assert.equal(received.body,'Un nouveau message est disponible dans votre équipe.');
  assert.deepEqual(Object.keys(received).sort(),['id','title','body','dateLabel','unread','initials'].sort());
  assert(!JSON.stringify(current).includes('Texte privé QA'));
  assert(!(await inbox(driver)).notifications.some(row=>row.id.startsWith('teamChat_')));
  assert(!(await inbox(manager)).notifications.some(row=>row.id.startsWith('teamChat_')));
  passed('fresh-callable-read-receives-one-generic-team-alert-without-message-or-team-metadata');
  await call('markNotificationRead',parent,{userId:parent.uid,notificationId:note.id});
  const marked=(await note.ref.get()).data();assert.equal((await inbox(parent)).notifications.find(row=>row.id===note.id).unread,false);
  await call('markNotificationRead',parent,{userId:parent.uid,notificationId:note.id});
  assert.deepEqual((await note.ref.get()).data(),marked);
  assert.equal((await call('getTeamChatMessages',parent,f.target)).items[0].needsRead,true);
  passed('read-confirmation-is-reflected-without-changing-team-message-read-state-or-its-first-timestamp');
  await f.guardian(parent,'revoke',2);
  assert(!(await inbox(parent)).notifications.some(row=>row.id===note.id));
  assert((await inbox(otherAdult)).notifications.some(row=>row.id.startsWith('teamChat_')));
  await f.guardian(parent,'request',3);await f.guardian(parent,'verify',4);
  assert(!(await inbox(parent)).notifications.some(row=>row.id===note.id));
  passed('revocation-and-renewed-admission-remove-old-alerts-without-affecting-another-member');
  const later=await send(driver,'Nouveau message après le nouvel accord QA');
  const laterNote=(await db.collection('teamChatNotifications').where('messageId','==',later.messageId).get()).docs.find(row=>row.get('userId')===parent.uid);
  assert.deepEqual((await inbox(parent)).notifications.filter(row=>row.id.startsWith('teamChat_')).map(row=>row.id),[laterNote.id]);
  passed('only-a-message-after-the-current-admission-returns-in-the-authoritative-refresh');
  const original=(await laterNote.ref.get()).data();await laterNote.ref.update({body:'Contenu privé injecté QA'});
  await denied('getNotificationInbox',parent,{},'FAILED_PRECONDITION');await laterNote.ref.set(original);
  assert.equal((await inbox(parent)).notifications.find(row=>row.id===laterNote.id).body,original.body);
  passed('corrupt-private-alert-metadata-fails-closed-and-a-fresh-explicit-read-recovers');
  await db.collection('teams').doc(f.teamId).delete();
  await db.collection('teams').doc(f.teamId).create({clubId:f.clubId,name:'Equipe recréée QA',status:'active'});
  assert(!(await inbox(parent)).notifications.some(row=>row.id.startsWith('teamChat_')));
  assert(!(await inbox(otherAdult)).notifications.some(row=>row.id.startsWith('teamChat_')));
  assert.deepEqual((await inbox(parent)).notifications,initial.notifications);
  passed('recreated-team-hides-old-alerts-and-keeps-ordinary-notifications-unchanged');
  const owned=new Set([`teams/${f.teamId}`,`guardianVerifications/${f.parentVerificationId}`]);
  assert.equal((await db.doc(`guardianVerifications/${f.parentVerificationId}`).get()).get('revision'),5);
  for(const [path,data]of baseline)if(!owned.has(path))assert.deepEqual((await db.doc(path).get()).data(),data,path);
  assert.deepEqual((await auth.listUsers(1000)).users.map(user=>({uid:user.uid,claims:user.customClaims??{},disabled:user.disabled})),claims);
  protectedBaselinePreserved=true;
},{firestore:{terminate:async()=>{await db.terminate();firestoreClientTerminated=true;}},
  closeApp:async app=>{await deleteApp(app);adminClientClosed=true;}});
const paths=['functions/src/callables/notificationInbox.ts','functions/src/index.ts','functions/src/services/teamNotificationAccess.ts',
  'functions/src/services/teamConversationAuthority.ts','functions/src/services/teamEnrollmentAuthority.ts','functions/src/domain/inbox.ts',
  'scripts/qa/team-alert-fixture.mjs','scripts/qa/local-notification-inbox-suite.mjs','scripts/qa/run-local-team-conversation.mjs'];
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT,JSON.stringify({projectId:'demo-sgm-local-qa',runId:process.env.SGM_LOCAL_RUN_ID,
  testedAt:new Date().toISOString(),scope:'local-notification-inbox-callables-not-native-or-push-delivery',completed:true,steps,
  isolation:{protectedBaselinePreserved},adminClientClosed,firestoreClientTerminated,physicalDevice:false,nativeUiExecuted:false,
  pushDeliveryVerified:false,productionWrites:false,providerRequests:0,mapRequests:0,realPayments:false,
  sourceFiles:Object.fromEntries(paths.map(file=>[file,createHash('sha256').update(readFileSync(resolve(import.meta.dirname,'../..',file))).digest('hex')]))
},null,2)+'\n',{flag:'wx'});
console.log(`Passed ${steps.length} notification-inbox callable cases; native arrival and push remain unverified.`);
