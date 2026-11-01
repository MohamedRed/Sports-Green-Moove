import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {parseDocument} from 'yaml';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('registration is authenticated, strict and cannot return token or installation proof',()=>{
  const api=read('functions/src/callables/teamPushRegistration.ts');
  assert(api.includes('requireAuth(request.auth?.uid)'));assert(api.includes('parseCallableData(teamPushRegistrationSchema, request.data)'));
  assert(read('functions/src/index.ts').includes('export { registerTeamPushDevice }'));
  const service=read('functions/src/services/teamPushRegistration.ts');
  for(const marker of ['account.disabled','requireTeamConversationAdult','previous.secretHash !== secretHash',
    'previous.fingerprint !== teamPushRegistrationFingerprint','input.revision <= previous.revision && !reused',
    'input.token === null && previous.userId !== uid','old.revision !== previous!.revision','teamPushDeviceLimit',
    'transaction.delete(','transaction.set('])assert(service.includes(marker),marker);
  assert(service.indexOf('The prior device token identity requires review.')<service.indexOf('if (reused) return'));
  for(const result of service.matchAll(/return \{([^}]+)\}/g)){
    assert.doesNotMatch(result[1],/token|installationSecret|secretHash|installationId/);
    assert.match(result[1],/currentUserId/);
  }
  assert.doesNotMatch(service,/console\.|logger\.|getMessaging\(|\.send\(/);
  const authority=read('functions/src/services/teamConversationAuthority.ts');
  assert(authority.includes('currentTeamConversationAccount(transaction, uid, accounts)'));
  assert(authority.includes('!adultTeamChatAccount(account.customClaims, profile.data())'));
  const accounts=read('functions/src/services/teamConversationAccounts.ts');
  assert(accounts.includes('accounts.transaction !== transaction'));assert(accounts.includes('account.disabled'));
  assert(accounts.includes('account.uid !== uid'));assert(accounts.includes('getAuth().getUser(uid)'));
});
test('token storage is server-only and its active-device query is codified',()=>{
  const rules=read('firestore.rules');
  for(const path of ['teamPushInstallations/{installationId}','teamPushTokens/{tokenHash}'])
    assert(rules.includes(`match /${path} {\n      allow read, write: if false;`));
  const indexes=JSON.parse(read('firestore.indexes.json')).indexes;
  assert(indexes.some(row=>row.collectionGroup==='teamPushInstallations'&&
    row.fields.map(field=>field.fieldPath).join(',')==='userId,active'));
  const suite=read('scripts/qa/local-team-push-registration-suite.mjs');
  for(const marker of ['pushDeliveryVerified:false','realPhoneTokenRegistered:false','nativeUiExecuted:false',
    'providerRequests:0','productionWrites:false','protectedBaselinePreserved=true'])assert(suite.includes(marker),marker);
  const runner=read('scripts/qa/run-local-team-conversation.mjs');
  assert(runner.includes('assert.deepEqual(report.sourceFiles,registrationSources)'));
  assert(runner.includes('assert.deepEqual(hashSources(),registrationSources)'));
});
test('the agreed old-device screenshot policy remains explicit without claiming physical proof',()=>{
  const main=read('android/app/src/main/java/be/sportgreenmoove/app/MainActivity.kt');
  assert(main.includes('if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) setRecentsScreenshotEnabled(false)'));
  assert(!main.includes('FLAG_SECURE'));
  const contract=read('docs/contracts/team-push-notifications.md');
  assert(contract.includes('preserve screenshots and video'));assert(contract.includes('not retroactively establish older-device physical proof'));
});
test('web smoke executes and retains registration evidence without removing original alert coverage',()=>{
  const workflow=parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for(const event of ['push','pull_request'])assert(workflow.on[event].paths.includes('tests/team-push*.test.mjs'));
  const steps=workflow.jobs['people-safety'].steps,run=steps.find(step=>step.name==='Test team alerts and pending phone delivery');
  assert(run.run.startsWith('npm run test:team-alerts && node --test tests/team-alerts-contract.test.mjs'));
  assert(run.run.includes('npm run test:team-push-registration'));
  assert(run.run.includes('tests/team-push-registration-contract.test.mjs'));
  const upload=steps.find(step=>step.with?.name==='team-alert-services-results');
  assert(upload.with.path.includes('team-alerts-services.json'));assert(upload.with.path.includes('team-push-registration-services.json'));
});
