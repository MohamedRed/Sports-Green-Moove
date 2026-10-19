import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
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
  assert(stop < source.indexOf('Intent.FLAG_ACTIVITY_REORDER_TO_FRONT'));
  assert(source.includes('activity.state == Lifecycle.State.RESUMED'));
  assert(source.includes('assertEquals(Lifecycle.State.CREATED, activity.state)'));
  assert(source.includes('assertEquals("sgm-qa-driver", FirebaseAuth.getInstance().currentUser?.uid)'));
  const peer = text('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalRideCompletionPeer.kt');
  for (const name of ['markPickup', 'markDropoff', 'endRide']) assert(peer.includes(`call("${name}"`));
  assert(peer.includes('FirebaseApp.initializeApp(context, options, "local-completion-peer-'));
  assert(!peer.includes('setUserRoles'));
});
test('no positive report survives failed instrumentation, isolation, mock restoration or runtime disposal', () => {
  const host = text('scripts/qa/local-remote-ride-stop-ui.mjs');
  for (const fragment of ['assertInstrumentationPassed(transcript, 1)', "phase: 'remote-ride-stop'",
    'verifyCompletedRideFixtureIsolation(fixture)', 'setLocalMockPermission(shell, originalMockMode)', 'await deleteApp(getApp())']) assert(host.includes(fragment));
  assert(host.indexOf('if (failure) throw failure') < host.indexOf("'remote-ride-stop-app-results.json'"));
  const owner = text('scripts/qa/run-isolated-ride-ui.mjs');
  assert(owner.indexOf('runtime.cleanup()') < owner.indexOf('`${name}-results.json`'));
  assert(owner.indexOf('if (failure) throw failure') < owner.indexOf('`${name}-results.json`'));
});
test('the full suite retains every previous failure and executes the new case last', () => {
  const suite = text('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  assert(suite.indexOf('run-local-native-startup-ui.mjs') < suite.indexOf('run-local-remote-ride-stop-ui.mjs'));
  for (const name of ['test', 'capture', 'replay', 'observation', 'startup'])
    assert(suite.includes(`if [[ "$${name}_status" -ne 0 ]]; then exit "$${name}_status"; fi`));
  assert(suite.includes('exit "$remote_stop_status"'));
  const workflow = parseDocument(text('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const trigger of ['push', 'pull_request']) assert(workflow.on[trigger].paths.includes('tests/remote-ride-stop-contract.test.mjs'));
  assert(workflow.jobs.smoke.steps.some((step) => step.run?.includes('tests/remote-ride-stop-contract.test.mjs')));
});
