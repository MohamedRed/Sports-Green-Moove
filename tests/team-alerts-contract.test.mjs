import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {validateRetainedTeamAlerts,validateTeamAlertRun} from '../scripts/qa/team-alert-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('eleven retained service cases never accept native or push delivery',()=>{
  const run=validateRetainedTeamAlerts(process.cwd());assert.equal(run.steps.length,11);
  for(const key of ['physicalDevice','nativeUiExecuted','pushDeliveryVerified','phoneTokenRegistered','productionWrites'])
    assert.throws(()=>validateTeamAlertRun({...run,[key]:true}),undefined,key);
  assert.throws(()=>validateTeamAlertRun({...run,steps:run.steps.slice(1)}));
  assert.throws(()=>validateTeamAlertRun({...run,isolatedEnvironmentDestroyed:false}));
});

test('team alert fanout shares current authority and atomically preserves retry identity',()=>{
  const producer=read('functions/src/services/teamConversation.ts');
  assert(producer.indexOf('if (event.exists)')<producer.indexOf('await teamConversationAlertAudience'));
  assert(producer.indexOf('await teamConversationAlertAudience')<producer.indexOf('transaction.create(message'));
  for(const marker of ['collection("teamChatNotifications")','teamAlertId(operationId, userId)',
    'collection("teamPushOutbox")','status: "pending"','body: teamAlertBody','title: teamAlertTitle'])assert(producer.includes(marker),marker);
  assert(!producer.includes('collection("notifications")'));
  const audience=read('functions/src/services/teamConversationAlerts.ts');
  for(const marker of ['uid === senderUid','new Map<string, QueryDocumentSnapshot[]>',
    'candidates.size > teamAlertRecipientLimit','offset += 100','user.disabled','user.customClaims',
    'requireTeamConversationAccess(transaction','error.code !== "permission-denied"'])assert(audience.includes(marker),marker);
});
test('team alerts are server-only, revocable and never acknowledge a team message',()=>{
  const access=read('functions/src/services/teamNotificationAccess.ts');
  for(const marker of ['teamAlertSchema.safeParse','teamAlertId(', 'teamContext(team).teamInstanceId',
    'requireTeamConversationAccess','compareTimes(at, access.availableAfter) > 0'])assert(access.includes(marker),marker);
  const acknowledge=read('functions/src/callables/notificationRead.ts');
  assert(acknowledge.includes('mayReadTeamNotification'));assert(!acknowledge.includes('readReceipts'));
  for(const file of ['teamNotificationAccess','teamConversationAuthority','teamEnrollmentAuthority'])
    assert(!read(`functions/src/services/${file}.ts`).includes('../lib/firebase.js'),file+' must not initialize unrelated databases');
  const rules=read('firestore.rules');
  for(const path of ['teamChatNotifications/{notificationId}','teamPushOutbox/{eventId}'])
    assert(rules.includes(`match /${path} {\n      allow read, write: if false;`));
  const indexes=JSON.parse(read('firestore.indexes.json'));
  assert(indexes.indexes.some(index=>index.collectionGroup==='teamChatNotifications'&&
    index.fields.some(field=>field.fieldPath==='userId')&&index.fields.some(field=>field.fieldPath==='createdAt')));
});
test('the dedicated trial and CI do not promote a pending envelope to phone delivery',()=>{
  const trial=read('scripts/qa/local-team-alert-suite.mjs');
  for(const marker of ['pushDeliveryVerified:false','phoneTokenRegistered:false','nativeUiExecuted:false',
    'physicalDevice:false','productionWrites:false','protectedBaselinePreserved=true'])assert(trial.includes(marker),marker);
  const workflow=read('.github/workflows/web-integration-smoke.yml');
  assert(workflow.includes('npm run test:team-alerts && node --test tests/team-alerts-contract.test.mjs'));
  assert.equal(workflow.split('"tests/team-alerts*.test.mjs"').length-1,2);
});
test('public follow-up keeps prior phone dates, galleries and partial notification scope',()=>{
  const team=content.flows.find(row=>row.id==='team-conversation');
  assert.equal(team.status,'partial');assert.equal(team.checkedAt,'2026-11-01');
  assert.equal(team.phone.checkedAt,'2026-10-21');assert.equal(team.latestEvidence,'phone');
  assert.equal(team.alertServices.checkedAt,'2026-11-01');
  assert(team.images.filter(image=>!image.file.startsWith('team-alert-phone-')).every(image=>image.alt.includes('21 octobre')&&image.checkedAt==='2026-10-21'));
  assert.match(team.remaining,/notifications.*téléphones/);
  const update=content.updates.find(row=>row.source==='docs/release/evidence/team-alert-services-2026-11-01/README.md');
  assert.match(update.text,/locaux/);assert.match(update.text,/reste à terminer/);
  assert.doesNotMatch(update.text,/Firebase|BrowserStack|SDK|FCM/);
});
