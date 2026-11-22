import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertSessionDisconnectBefore, assertSessionDisconnectStage, sessionDisconnectScope,
  sessionDisconnectCaptures } from '../scripts/qa/session-disconnect-evidence.mjs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function fixture() {
  const runId = 'a'.repeat(32), projectId = 'demo-sgm-local-qa';
  const screenshots = Object.fromEntries(sessionDisconnectCaptures.map((name, index) => [name, String(index + 1).repeat(64)]));
  const before = { scope: sessionDisconnectScope + '-checkpoint', projectId, runId, uidBefore: 'sgm-qa-parent',
    physicalDevice: false, initialFailureVisible: true, noImplicitDisconnect: true,
    explicitDisconnectReachedSignIn: true, authEmptyAfterDisconnect: true, processId: 100,
    screenshots: Object.fromEntries(Object.entries(screenshots).slice(0, 2)) };
  const stopped = { scope: 'disposable-local-app-force-stop', projectId, runId, appId: 'be.sportgreenmoove.app.local',
    preparedProcessId: 100, observedBeforePid: 100, forceStopIssued: true, noProcessAfterStop: true };
  const after = { scope: sessionDisconnectScope, projectId, runId, preparedProcessId: 100, processId: 200,
    authEmptyBeforeLaunch: true, signedOutScreenAfterProcessRestart: true, authEmptyAfterLaunch: true,
    firestoreClientTerminated: true, completed: true, physicalDevice: false, realNetworkLossVerified: false, screenshots };
  const proxy = { scope: 'local-session-restoration-controlled-callable-rejection-not-network-loss',
    projectId, runId, uid: 'sgm-qa-parent', phase: 'reject', transitions: [], attempts: [
      { phase: 'reject', method: 'initializeUserProfile', uid: 'sgm-qa-parent', injectedRejection: true, downstreamStatus: 503 },
    ] };
  return { before, stopped, after, proxy, runId };
}
const validate = f => assertSessionDisconnectStage(f.before, f.stopped, f.after, f.proxy, f.runId);
test('synthetic two-process receipt validation preserves its explicit local-only scope', () => {
  const f = fixture(), original = structuredClone(f); validate(f); assert.deepEqual(f, original);
  f.stopped.observedBeforePid = null; validate(f);
  assert.equal(f.after.physicalDevice, false); assert.equal(f.after.realNetworkLossVerified, false);
});
for (const [label, mutate] of [
  ['silent sign-out', f => { f.before.noImplicitDisconnect = false; }],
  ['unverified UI action', f => { f.before.explicitDisconnectReachedSignIn = false; }],
  ['cached SDK identity after action', f => { f.before.authEmptyAfterDisconnect = false; }],
  ['same process', f => { f.after.processId = 100; }],
  ['missing force-stop', f => { f.stopped.forceStopIssued = false; }],
  ['running process after stop', f => { f.stopped.noProcessAfterStop = false; }],
  ['foreign process', f => { f.stopped.observedBeforePid = 300; }],
  ['wrong prepared process', f => { f.after.preparedProcessId = 300; }],
  ['restored SDK identity before launch', f => { f.after.authEmptyBeforeLaunch = false; }],
  ['signed-in SDK identity after launch', f => { f.after.authEmptyAfterLaunch = false; }],
  ['missing sign-in screen', f => { f.after.signedOutScreenAfterProcessRestart = false; }],
  ['real-outage promotion', f => { f.after.realNetworkLossVerified = true; }],
  ['changed first capture', f => { f.after.screenshots[sessionDisconnectCaptures[0]] = 'f'.repeat(64); }],
  ['missing reopened capture', f => { delete f.after.screenshots[sessionDisconnectCaptures[2]]; }],
  ['successful initial request', f => { f.proxy.attempts[0].downstreamStatus = 200; }],
  ['automatic extra request', f => { f.proxy.attempts.push(structuredClone(f.proxy.attempts[0])); }],
  ['recovery instead of disconnect', f => { f.proxy.phase = 'recover'; }],
  ['foreign account', f => { f.proxy.uid = 'sgm-qa-driver'; }],
]) test(`${label} cannot pass the disconnect checkpoint validation`, () => {
  const f = fixture(); mutate(f); assert.throws(() => validate(f));
});
test('the first checkpoint refuses missing evidence before stopping an app', () => {
  const f = fixture(); delete f.before.screenshots; assert.throws(() => assertSessionDisconnectBefore(f.before, f.runId));
});
test('the host runs both real-app methods around a guarded force-stop without reinstalling', () => {
  const host = read('scripts/qa/local-session-disconnect-ui.mjs');
  const first = host.indexOf("await instrument('disconnectFromFailedRestoration')");
  const stop = host.indexOf('stopped = stopDisposableAppProcess(');
  const second = host.indexOf("await instrument('reopenSignedOutSessionInNewProcess')");
  assert(first > 0 && stop > first && second > stop);
  assert(host.includes('nativeCaseCount: 2')); assert(host.includes('assertSessionDisconnectStage('));
  assert(host.includes('verifySessionRestorationRecords(baseline,'));
  assert(read('scripts/qa/local-disposable-process-stop.mjs').includes("'local-session-disconnect-before.json'"));
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalSessionDisconnectTest.kt');
  for (const text of ['ActivityScenario.launch(MainActivity::class.java)',
    'compose.onNodeWithTag("session.restore.disconnect").performScrollTo().performClick()',
    'assertNotEquals(before.getInt("processId"), Process.myPid())',
    'assertNull("Signed-out SDK identity must persist before the app opens", FirebaseAuth.getInstance().currentUser)'])
    assert(native.includes(text), text);
  assert(!native.includes('AuthGateway by'));
});
