import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {teamPushDispatchFolder,validateTeamPushDispatch} from '../partner-portal/team-push-dispatch-validation.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('the durable dispatcher keeps provider calls outside transactions and isolates every owner/revision attempt',()=>{
  const prefix='functions/src/services/';
  const plan=read(prefix+'teamPushDispatchPlan.ts'),delivery=read(prefix+'teamPushDispatchDelivery.ts');
  assert(plan.includes('transaction.create(envelope.ref.collection("recipients")'));
  assert(plan.includes('if(recipient.status!=="queued")return recipient.deliveryIds??[]'));
  assert(plan.includes('teamPushDeviceLimit+1'));assert(plan.includes('owner.revision!==row.device.revision'));
  assert(delivery.includes('dispatchAlertIsCurrent(transaction,messageId,row.userId,envelope)'));
  assert(delivery.includes('device.revision===row.revision && device.fingerprint===row.fingerprint'));
  assert(delivery.includes('row.leaseId!==leaseId'));assert(delivery.includes('row.attempts>=teamPushAttemptLimit'));
  assert(delivery.indexOf('if(!claim)return;')<delivery.indexOf('await send(claim.token'));
  assert(!delivery.includes('console.'));assert(!delivery.includes('transaction.delete'));
  const recipient=read(prefix+'teamPushDispatch.ts');assert(recipient.includes('Promise.allSettled'));
  const provider=read(prefix+'teamPushProvider.ts');
  assert(provider.includes('data:{type:"teamMessage",notificationId}'));
  assert(!provider.includes('notification:{'));assert(!provider.includes('console.'));
  for(const guard of ['FUNCTIONS_EMULATOR','FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST','projectId.startsWith("demo-")'])
    assert(provider.includes(guard),guard);
  assert.equal((read('functions/src/teamPushDispatch.ts').match(/if\(!teamPushProviderEnabled\(\)\)return/g)??[]).length,2);
});
test('the retained evidence proves injected transport and native component results, not real delivery or whole-gate acceptance',()=>{
  const result=validateTeamPushDispatch(process.cwd());assert.equal(result.serviceCases,14);assert.equal(result.native.routeCases,8);
  const flow=content.flows.find(row=>row.id==='team-conversation');assert.equal(flow.status,'partial');
  assert.equal(flow.phone.checkedAt,'2026-10-21');assert.equal(flow.latestEvidence,'phone');
  assert.equal(flow.pushDispatch.source,teamPushDispatchFolder+'review.json');
  const updates=content.updates.filter(row=>row.source===teamPushDispatchFolder+'README.md');assert.equal(updates.length,2);
  for(const update of updates)assert.doesNotMatch(update.title+update.text,/\b(?:firebase|browserstack|SDK|API|FCM|CI|provider)\b/i);
  const release=JSON.parse(read('docs/release/evidence-manifest.json'));
  for(const row of release.operationalUserFlowEvidence.items.filter(row=>row.id.startsWith('team_push_')))assert.equal(row.status,'pending');
});
test('service smoke exercises the new dispatch mode separately and retains its disposal result',()=>{
  const workflow=parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for(const event of ['push','pull_request'])assert(workflow.on[event].paths.includes('tests/team-push*.test.mjs'));
  const steps=workflow.jobs['people-safety'].steps;
  const step=steps.find(row=>row.name==='Test durable team push dispatch without provider sends');
  assert.equal(step.run,'node scripts/qa/run-local-team-conversation.mjs --push-dispatch && node --test tests/team-push-dispatch.test.mjs');
  assert.equal(step.env.SGM_LOCAL_FLOW_OUTPUT,'${{ runner.temp }}/team-push-dispatch-services.json');
  assert(steps.find(row=>row.with?.name==='team-alert-services-results').with.path.includes('team-push-dispatch-services.json'));
});
test('remote foreground return preserves the launch identity and checks both lifecycle observers before normal disposal',()=>{
  const source=read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalRemoteRideStopFlowTest.kt');
  assert(source.includes('returnToForegroundIntent(launchIntent)'));
  assert(source.includes('trackedActivity.intent.filterEquals(launchIntent)'));
  assert(source.includes('assertEquals(Lifecycle.State.RESUMED, activity.state)'));
  assert(!source.includes('trackedActivity.finish()'));
  assert(!source.includes('catch'));assert(source.includes('Stage.STOPPED'));assert(source.includes('Stage.RESUMED'));
});
for(const [file,key,value]of [['review.json','productionDeployed',true],['review.json','pushDeliveryVerified',true],
  ['review.json','nativeNotificationTapVerified',true],['review.json','releaseAccepted',true],
  ['services.json','providerRequests',1],['services.json','productionWrites',true],['native-results.json','physicalDevice',true]])
  test(`rehashed dispatcher evidence cannot promote ${file} ${key}`,t=>{
    const temp=mkdtempSync(resolve(tmpdir(),'sgm-dispatch-evidence-'));t.after(()=>rmSync(temp,{recursive:true,force:true}));
    cpSync(teamPushDispatchFolder,temp,{recursive:true});
    const path=resolve(temp,file),record=JSON.parse(readFileSync(path));record[key]=value;writeFileSync(path,JSON.stringify(record));
    const index=resolve(temp,'artifact-sha256.json'),hashes=JSON.parse(readFileSync(index));
    hashes[file]=createHash('sha256').update(readFileSync(path)).digest('hex');writeFileSync(index,JSON.stringify(hashes));
    assert.throws(()=>validateTeamPushDispatch(process.cwd(),temp));
  });
