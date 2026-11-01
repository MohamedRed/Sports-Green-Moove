import assert from 'node:assert/strict';
import test from 'node:test';
import {cpSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {parseDocument} from 'yaml';
import {teamPushAlertSources} from '../scripts/qa/team-push-alert-sources.mjs';
import {teamPushAlertFolder,validateTeamPushAlertAuthorization} from '../partner-portal/team-push-alert-validation.mjs';
import {content} from '../partner-portal/content.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('opaque alert resolution uses existing current account and admission authority without sending or acknowledging',()=>{
  const api=read('functions/src/callables/teamPushAlert.ts');
  assert(api.includes('requireAuth(request.auth?.uid)'));
  assert(api.includes('parseCallableData(teamPushAlertRequestSchema, request.data)'));
  assert(read('functions/src/index.ts').includes('export { resolveTeamPushAlert }'));
  const service=read('functions/src/services/teamPushAlert.ts');
  for(const marker of ['teamConversationAccounts(transaction)','requireTeamConversationAdult(transaction, uid, claims, accounts)',
    'device.userId !== uid','device.revision !== input.revision','device.secretHash !== teamPushSecretHash',
    'teamPushRegistrationFingerprint(parsed.data.userId, parsed.data)','owner.data.installationId !== installationId',
    'owner.data.userId !== uid','owner.data.revision !== device.revision','!device.active || device.token === null',
    'mayReadTeamNotification(transaction, uid, claims, snapshot.id, snapshot.data()!, accounts)',
    'input.purpose === "display" && alert.read','title: teamAlertTitle, body: teamAlertBody'])assert(service.includes(marker),marker);
  assert.doesNotMatch(service,/console\.|logger\.|getMessaging\(|\.send\(|transaction\.(set|update|create|delete)\(/);
  assert.doesNotMatch(service,/\b(?:url|deepLink|senderName|childId):/);
});
test('isolated real-callable trial preserves explicit delivery exclusions and unchanged tested sources',()=>{
  const suite=read('scripts/qa/local-team-push-alert-suite.mjs');
  for(const marker of ['pushDeliveryVerified:false','realPhoneTokenRegistered:false','nativeUiExecuted:false',
    'physicalDevice:false','providerRequests:0','productionWrites:false','protectedBaselinePreserved=true',
    'no-message-receipts-or-provider-sends','current-child-claims-disabled-state-child-profile-and-child-link',
    'manager-revocation-and-reapproval-start-a-new-history-boundary'])assert(suite.includes(marker),marker);
  for(const path of ['functions/src/services/teamPushAlert.ts','functions/src/services/teamNotificationAccess.ts',
    'functions/src/services/teamConversationAuthority.ts','functions/src/services/teamConversationAccounts.ts',
    'scripts/qa/local-team-push-alert-suite.mjs','scripts/qa/run-local-team-conversation.mjs'])assert(teamPushAlertSources.includes(path),path);
  const runner=read('scripts/qa/run-local-team-conversation.mjs');
  assert(runner.includes("['--push-alert','local-team-push-alert-suite.mjs']"));
  assert(runner.includes('assert.deepEqual(report.sourceFiles,registrationSources)'));
  assert(runner.includes('assert.deepEqual(hashSources(),registrationSources)'));
  assert(runner.includes("if(['--push-alert','--push-dispatch'].includes(mode))assert.equal(report.firestoreClientTerminated,true)"));
});
test('web smoke runs and retains the authorization trial alongside all existing alert and device suites',()=>{
  const workflow=parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for(const event of ['push','pull_request'])assert(workflow.on[event].paths.includes('tests/team-push*.test.mjs'));
  const steps=workflow.jobs['people-safety'].steps;
  const step=steps.find(row=>row.name==='Test current-device team alert resolution');
  assert.equal(step.env.SGM_LOCAL_FLOW_OUTPUT,'${{ runner.temp }}/team-push-alert-services.json');
  assert.equal(step.run,'npm run test:team-push-alert && node --test tests/team-push-alert-contract.test.mjs tests/team-push-native-consumer.test.mjs tests/native-alert-first-run.test.mjs tests/team-push-removal-observation.test.mjs');
  const existing=steps.find(row=>row.name==='Test team alerts and pending phone delivery');
  assert(existing.run.includes('npm run test:team-alerts'));assert(existing.run.includes('npm run test:team-push-registration'));
  assert(steps.find(row=>row.with?.name==='team-alert-services-results').with.path.includes('team-push-alert-services.json'));
});
test('retained local authority proof preserves phone history, public media and pending release requirements',()=>{
  const result=validateTeamPushAlertAuthorization(process.cwd());assert.equal(result.steps.length,16);
  const flow=content.flows.find(row=>row.id==='team-conversation');
  assert.equal(flow.pushAlertAuthorization.source,teamPushAlertFolder+'services.json');
  assert.equal(flow.status,'partial');assert.equal(flow.latestEvidence,'phone');assert.equal(flow.phone.checkedAt,'2026-10-21');
  const update=content.updates.find(row=>row.source===teamPushAlertFolder+'README.md');assert(update);
  assert.match(update.text,/en local/);assert.match(update.text,/restent à terminer/);
  assert.doesNotMatch(update.title+update.text,/\b(?:firebase|browserstack|SDK|API|FCM|CI)\b/i);
  const evidence=JSON.parse(read('docs/release/evidence-manifest.json')).operationalUserFlowEvidence.items;
  for(const item of evidence.filter(row=>row.id.startsWith('team_push_')))assert.equal(item.status,'pending',item.id);
});
for(const [key,value]of [['physicalDevice',true],['nativeUiExecuted',true],['pushDeliveryVerified',true],
  ['realPhoneTokenRegistered',true],['providerRequests',1],['isolatedEnvironmentDestroyed',false],
  ['releaseAccepted',true],['dispatcherImplemented',true]])test(`rehashed resolver evidence cannot promote ${key}`,t=>{
  const temp=mkdtempSync(resolve(tmpdir(),'sgm-push-alert-evidence-'));
  t.after(()=>rmSync(temp,{recursive:true,force:true}));cpSync(teamPushAlertFolder,temp,{recursive:true});
  const file=resolve(temp,'services.json'),report=JSON.parse(readFileSync(file));report[key]=value;
  writeFileSync(file,JSON.stringify(report));writeFileSync(resolve(temp,'artifact-sha256.json'),JSON.stringify({
    'services.json':createHash('sha256').update(readFileSync(file)).digest('hex')}));
  assert.throws(()=>validateTeamPushAlertAuthorization(process.cwd(),temp));
});
