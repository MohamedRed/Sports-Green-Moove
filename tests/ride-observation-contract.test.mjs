import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';
import { validatePassengerObservationOwnership } from '../scripts/qa/passenger-observation-ownership-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const text = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const base = 'docs/release/evidence/ride-observation-services-2026-10-19/';
const services = JSON.parse(text(base + 'services.json'));
test('the passenger regression retains failing originals, passing units and an explicit native replay gap', () => {
  const report = validatePassengerObservationOwnership(root, content.passengerStatusOwnershipRecheck);
  assert.equal(report.ciFailureCauseProven, false); assert.equal(report.nativeUiExecuted, false);
  const update = content.updates.find(item => item.source === content.passengerStatusOwnershipRecheck.source.replace('summary.json', 'README.md'));
  assert.equal(update.flow, 'ride-lifecycle'); assert.match(update.text, /complet reste à rejouer/);
});
test('the selected-id API proof is an independently completed seven-group authenticated run', () => {
  assert.equal(services.projectId, 'demo-sgm-local-qa');
  assert.equal(services.scope, 'local-ride-observation-callables-not-native-or-physical');
  assert.equal(services.adminClientClosed, true); assert.equal(services.testCount, 1);
  assert.deepEqual(services.steps, [{ id: 'ride-observation-services', status: 'passed' }]);
  assert.equal(services.checks.length, 7); assert.equal(new Set(services.checks.map((check) => check.id)).size, 7);
  assert(services.checks.every((check) => check.status === 'passed'));
  assert(services.checks.some((check) => check.id === 'explicit-observer-id-cannot-be-replaced-by-another-active-ride'));
  assert(services.checks.some((check) => check.id === 'completion-clears-the-observed-ride-without-switching-to-a-different-one'));
  assert(text(base + 'services.txt').includes('Script exited successfully (code 0)'));
  assert(text(base + 'services.txt').includes('Stopping Database Emulator'));
  assertRetainedSourceFiles(root, services.sourceFiles);
  for (const key of ['nativeUiExecuted', 'physicalDevice', 'productionWrites']) assert.equal(services[key], false);
  assert.equal(services.providerRequests, 0);
  for (const [file, hash] of Object.entries(JSON.parse(text(base + 'artifact-sha256.json'))))
    assert.equal(createHash('sha256').update(text(base + file)).digest('hex'), hash);
});
test('stream ownership, cancellation and lifecycle retain identity checks and server authorization', () => {
  const gateway = text('android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidRideObservationGateway.kt');
  for (const fragment of ['auth.currentUser === owner', 'auth.removeAuthStateListener', 'reference.removeEventListener',
    'rideListener.remove()', '.conflate().mapLatest', 'mapOf("rideSessionId" to rideSessionId)', 'it.observation != null']) assert(gateway.includes(fragment));
  const effect = text('android/app/src/main/java/be/sportgreenmoove/app/ui/ActiveRideObservationEffect.kt');
  assert(effect.includes('repeatOnLifecycle(Lifecycle.State.STARTED)')); assert(effect.includes('state.close()'));
  const lookup = text('functions/src/lib/activeRideLookup.ts');
  assert(lookup.includes('if (!canReadRide(uid, roleKeys, ride))')); assert(lookup.includes('ride.status === "active"'));
  const data = text('android/app/src/main/java/be/sportgreenmoove/app/ui/AppDataState.kt');
  assert(data.includes('account == accountGeneration')); assert(data.includes('rideRequest == rideGeneration'));
});
test('age uses structured server observations, elapsed realtime and complete request latency', () => {
  const state = text('android/app/src/main/java/be/sportgreenmoove/app/ui/ActiveRideObservationState.kt');
  assert(state.includes('elapsed + requestDuration')); assert(state.includes('delay(1_000)'));
  assert(!state.includes('System.currentTimeMillis')); assert(!state.includes('.retry('));
  const age = text('android/app/src/main/java/be/sportgreenmoove/app/domain/RideObservationAge.kt');
  assert(age.includes('vehicleAge > 90_000')); assert(age.includes('!observation.vehicleHasPoint'));
  assert(age.includes('requireNotNull(ride.observation)')); assert(!age.includes('split('));
  const rootApp = text('android/app/src/main/java/be/sportgreenmoove/app/ui/SportsGreenMooveApp.kt');
  assert(rootApp.includes('rideObservation.phase == RideObservationPhase.Live'));
  assert(rootApp.includes('includeActiveRide = false'));
});
test('passenger commands cannot compete with live observation or weaken ride completion', () => {
  const actions = text('android/app/src/main/java/be/sportgreenmoove/app/ui/SportsGreenMooveRideActions.kt');
  const passenger = actions.slice(actions.indexOf('fun launchPassengerStatusUpdate('), actions.indexOf('fun launchEndActiveRide('));
  assert(passenger.includes('providers.firebase.markPickup(')); assert(passenger.includes('providers.firebase.markDropoff('));
  assert(!passenger.includes('getActiveRide(')); assert(!passenger.includes('setActiveRide'));
  const monitor = text('android/app/src/main/java/be/sportgreenmoove/app/ui/RideMonitorScreen.kt');
  assert(monitor.includes('activeRide.passengers.all { it.pickupStatus == "pickedUp" && it.dropoffStatus == "droppedOff" }'));
  const regression = text('android/app/src/test/java/be/sportgreenmoove/app/ui/PassengerStatusObservationOwnershipTest.kt');
  for (const fragment of ['pickupDoesNotCreateASecondSnapshotWriter', 'dropoffDoesNotCreateASecondSnapshotWriter',
    'advanceTimeBy(1_000)', 'data.rideObserverSink', 'No competing getActiveRide response']) assert(regression.includes(fragment));
});
test('activity recreation keeps the exact configured local database instead of resolving a second SDK instance', () => {
  const runtime = text('android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidRuntime.kt');
  assert(runtime.includes('rides = FirebaseAndroidRideObservationGateway(FirebaseAndroidEmulatorConfig.database())'));
  assert(runtime.includes('checkNotNull(localDatabase)'));
  assert(runtime.includes('localDatabase = FirebaseDatabase.getInstance().also { it.useEmulator(host, 9000) }'));
  const gateway = text('android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidRideObservationGateway.kt');
  assert(!gateway.includes('FirebaseDatabase.getInstance()'));
  const replay = text('scripts/qa/local-ride-observation-ui.mjs');
  assert(replay.includes('await execute(adb'));
  assert(replay.includes('await execute(resolve(android'));
});
test('the independent native replay cannot replace the original full suite or turn failed setup into success', () => {
  const suite = text('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  assert(suite.includes('run-local-android-flows.mjs'));
  assert(suite.includes('exit "$replay_status"'));
  const focused = text('scripts/run-focused-android-ui.sh');
  assert(focused.includes('emergency-identity|ride-observation|native-startup|remote-ride-stop'));
  assert(focused.includes('run-local-$phase-ui.mjs')); assert(focused.includes('exit "$flow_status"'));
  const host = text('scripts/qa/local-ride-observation-ui.mjs');
  for (const fragment of ['assertInstrumentationPassed(transcript, 1)', "phase: 'ride-observation'", 'verifyRideObservationFixture',
    'cleanupRideObservationFixture', 'resetDisposableLocalApps', 'parentSignedOut']) assert(host.includes(fragment));
  assert(host.indexOf('await deleteApp(getApp())') < host.indexOf("'ride-observation-results.json'"));
  assert(!host.includes('process.exit('));
});
test('external distribution cannot reuse the exposed key or publish an unready backend on push', () => {
  const workflow = parseDocument(text('.github/workflows/android-browserstack.yml')).toJSON();
  const inputs = workflow.on.workflow_dispatch.inputs;
  assert.equal(inputs.credentials_rotated.default, false); assert.equal(inputs.live_backend_ready.default, false);
  const gate = workflow.jobs['browserstack-android-ui'].if;
  assert(gate.includes("github.event_name == 'workflow_dispatch'")); assert(gate.includes('inputs.credentials_rotated'));
  assert(gate.includes('inputs.live_backend_ready'));
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml']) {
    const source = text('.github/workflows/' + name);
    assert(source.includes('npm run test:ride-observation-services')); assert(source.includes('tests/ride-observation-contract.test.mjs'));
  }
});
test('the original startup failure stays negative instead of supplying a native or physical pass', () => {
  const failed = 'docs/release/evidence/ride-observation-startup-failure-2026-10-19/';
  const context = JSON.parse(text(failed + 'failure-context.json'));
  assert.equal(context.accepted, false); assert.equal(context.nativeScenarioCompleted, false);
  assert.equal(context.physicalDevice, false); assert.equal(context.productionWrites, false);
  assert.match(text(failed + 'LocalRideObservationFlowTest-instrumentation.txt'), /Process crashed/);
  assert.match(text(failed + 'startup-failure-anr.txt'), /failed to complete startup/);
  assert.match(text(failed + 'startup-failure-anr.txt'), /DexFileLoader|ZipEntry/);
  for (const [file, hash] of Object.entries(JSON.parse(text(failed + 'artifact-sha256.json')))) {
    const bytes = readFileSync(new URL('../' + failed + file, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, file);
    assert.doesNotMatch(bytes.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|-----BEGIN .*PRIVATE KEY/);
  }
});
