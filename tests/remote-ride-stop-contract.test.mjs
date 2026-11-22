import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import {validateForegroundReturnIntent,foregroundReturnFolder} from '../partner-portal/foreground-return-intent-validation.mjs';
import {content} from '../partner-portal/content.mjs';
const text = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const base = 'android/app/src/main/java/be/sportgreenmoove/app/services/';
test('the service owns the authoritative lifecycle watch independently of Activity visibility', () => {
  const source = text(base + 'ActiveRideLocationService.kt');
  for (const fragment of ['watchRideLifecycle(FirebaseFirestore.getInstance(), lease)',
    'ownership.accepts(lease) && decision == RideLifecycleDecision.STOP', 'lifecycleWatch?.remove()']) assert(source.includes(fragment));
  assert.equal((source.match(/stopLifecycleWatch\(\)/g) ?? []).length, 4);
  assert(!source.includes('repeatOnLifecycle'));
  const watch = text(base + 'ActiveRideLifecycleWatch.kt');
  for (const fragment of ['collection("rideSessions").document(lease.rideSessionId)',
    'MetadataChanges.INCLUDE', 'snapshot.metadata.isFromCache', 'if (error != null)', 'onDecision(RideLifecycleDecision.STOP)']) assert(watch.includes(fragment));
  assert(!watch.includes('.retry('));
});
test('the native case completes a real isolated ride while the driver remains signed in and backgrounded', () => {
  const source = text('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalRemoteRideStopFlowTest.kt');
  const completion = source.indexOf('it.complete(rideId, bookingId, childId)');
  const stop = source.indexOf('compose.waitUntil(20_000) { !serviceRunning(context) }');
  assert(source.indexOf('it.moveTaskToBack(true)') < completion); assert(completion < stop);
  assert(stop < source.indexOf('returnToForegroundIntent(launchIntent)'));
  assert(source.includes('observedActivityStage(trackedActivity) == Stage.RESUMED'));
  assert(source.includes('assertEquals(Stage.STOPPED, observedActivityStage(trackedActivity))'));
  assert(!source.includes('waitUntil(15_000) { activity.state'));
  assert(source.includes('trackedActivity.intent.filterEquals(launchIntent)'));
  assert(source.includes('assertEquals("sgm-qa-driver", FirebaseAuth.getInstance().currentUser?.uid)'));
  const peer = text('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalRideCompletionPeer.kt');
  for (const name of ['markPickup', 'markDropoff', 'endRide']) assert(peer.includes(`call("${name}"`));
  assert(peer.includes('FirebaseApp.initializeApp(context, options, "local-completion-peer-'));
  assert(!peer.includes('setUserRoles'));
});
test('no positive report survives failed instrumentation, isolation, mock restoration or runtime disposal', () => {
  const host = text('scripts/qa/local-remote-ride-stop-ui.mjs');
  for (const fragment of ['assertInstrumentationPassed(transcript, count)', "instrument('ForegroundReturnIntentTest', 2)",
    "instrument('LocalRemoteRideStopFlowTest', 1", "phase: 'remote-ride-stop'",
    'verifyCompletedRideFixtureIsolation(fixture)', 'setLocalMockPermission(shell, originalMockMode)', 'await deleteApp(getApp())']) assert(host.includes(fragment));
  assert(host.indexOf('if (failure) throw failure') < host.indexOf("'remote-ride-stop-app-results.json'"));
  const owner = text('scripts/qa/run-isolated-ride-ui.mjs');
  assert(owner.indexOf('runtime.cleanup()') < owner.indexOf('`${name}-results.json`'));
  assert(owner.indexOf('if (failure) throw failure') < owner.indexOf('`${name}-results.json`'));
});
test('remote stop has a dedicated case without replacing preceding independent cases', () => {
  const suite = text('scripts/run-focused-android-ui.sh');
  assert(suite.includes('emergency-identity|ride-observation|native-startup|remote-ride-stop'));
  assert(suite.includes('run-local-$phase-ui.mjs')); assert(suite.includes('exit "$flow_status"'));
  const workflow = parseDocument(text('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const trigger of ['push', 'pull_request']) assert(workflow.on[trigger].paths.includes('tests/remote-ride-stop-contract.test.mjs'));
  assert(workflow.jobs.smoke.steps.some((step) => step.run?.includes('tests/remote-ride-stop-contract.test.mjs')));
});
test('return intent copies every lifecycle filter but does not replay task-clearing flags or mutate the original',()=>{
  const ui='android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
  const helper=text(ui+'ForegroundReturnIntent.kt'),checks=text(ui+'ForegroundReturnIntentTest.kt');
  assert(helper.includes('Intent(launchIntent).setFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)'));
  for(const field of ['original.filterEquals(returned)','assertNotSame(original, returned)','assertEquals(launchFlags, original.flags)',
    'Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP',
    'setDataAndType','setPackage','addCategory','getStringExtra','Build.VERSION.SDK_INT >= 29'])assert(checks.includes(field),field);
  assert(!text(ui+'LocalRemoteRideStopFlowTest.kt').includes('trackedActivity.finish()'));
});
test('the repeated teardown failure and installed-library matching remain separate from candidate compilation and real release proof',()=>{
  const report=validateForegroundReturnIntent(process.cwd());assert.equal(report.candidate.nativeCasesCompiled,2);
  const flow=content.flows.find(row=>row.id==='native-startup');assert.equal(flow.status,'partial');assert.equal(flow.checkedAt,'2026-10-19');
  assert.equal(flow.foregroundReturnIntent.source,foregroundReturnFolder+'review.json');
  const update=content.updates.find(row=>row.source===foregroundReturnFolder+'README.md');assert(update);
  assert.doesNotMatch(update.title+update.text,/\b(?:firebase|browserstack|ActivityScenario|AndroidX|SDK|API|CI)\b/i);
});
