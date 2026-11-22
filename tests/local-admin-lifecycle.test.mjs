import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { withLocalAdminCleanup } from '../scripts/qa/local-admin-lifecycle.mjs';

const projectId = 'demo-sgm-local-qa';
function fixture(overrides = {}) {
  const calls = [], app = { options: { projectId } };
  return { calls, app, options: { app, firestore: { terminate: async () => { calls.push('firestore'); } },
    closeApp: async current => { assert.equal(current, app); calls.push('app'); }, ...overrides } };
}
test('closes both clients before returning a successful task value', async () => {
  const f = fixture(), value = { passed: true };
  assert.equal(await withLocalAdminCleanup(async () => { f.calls.push('task'); return value; }, f.options), value);
  assert.deepEqual(f.calls, ['task', 'firestore', 'app']);
});
test('awaits asynchronous closure instead of reporting success with live clients', async () => {
  const f = fixture(); let releaseFirestore, releaseApp, completed = false;
  f.options.firestore.terminate = () => new Promise(resolve => { releaseFirestore = resolve; });
  f.options.closeApp = () => new Promise(resolve => { releaseApp = resolve; });
  const running = withLocalAdminCleanup(async () => 'value', f.options).then(value => { completed = true; return value; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(completed, false); assert.equal(releaseApp, undefined);
  releaseFirestore(); await new Promise(resolve => setImmediate(resolve)); assert.equal(completed, false);
  releaseApp(); assert.equal(await running, 'value'); assert.equal(completed, true);
});
test('task failure is preserved after both clients close', async () => {
  const f = fixture(), primary = new Error('replay failed');
  await assert.rejects(withLocalAdminCleanup(async () => { throw primary; }, f.options), error => error === primary);
  assert.deepEqual(f.calls, ['firestore', 'app']);
});
test('also cleans up a synchronous preparation failure', async () => {
  const f = fixture(), primary = new Error('preparation failed');
  await assert.rejects(withLocalAdminCleanup(() => { throw primary; }, f.options), error => error === primary);
  assert.deepEqual(f.calls, ['firestore', 'app']);
});
test('app deletion is still attempted when Firestore termination fails', async () => {
  const error = new Error('Firestore close failed'), f = fixture();
  f.options.firestore.terminate = async () => { throw error; };
  await assert.rejects(withLocalAdminCleanup(async () => 'unused', f.options), failure => failure === error);
  assert.deepEqual(f.calls, ['app']);
});
test('app deletion failure cannot be returned as task success', async () => {
  const f = fixture(), error = new Error('App close failed'); f.options.closeApp = async () => { throw error; };
  await assert.rejects(withLocalAdminCleanup(async () => 'unused', f.options), failure => failure === error);
  assert.deepEqual(f.calls, ['firestore']);
});
test('preserves the task failure and both cleanup failures in order', async () => {
  const failures = ['task', 'firestore', 'app'].map(label => new Error(label)), f = fixture();
  f.options.firestore.terminate = async () => { throw failures[1]; };
  f.options.closeApp = async () => { throw failures[2]; };
  await assert.rejects(withLocalAdminCleanup(async () => { throw failures[0]; }, f.options), error => {
    assert(error instanceof AggregateError); assert.deepEqual(error.errors, failures); return true;
  });
});
test('rejects a non-isolated app without running the task or closing foreign clients', async () => {
  const f = fixture({ app: { options: { projectId: 'another-project' } } });
  await assert.rejects(withLocalAdminCleanup(async () => f.calls.push('task'), f.options), /isolated QA/);
  assert.deepEqual(f.calls, []);
});
test('the complete replay only records success outside its owned client lifecycle', () => {
  const source = readFileSync('scripts/qa/local-android-session.mjs', 'utf8');
  const start = source.indexOf('await withLocalAdminCleanup(async () => {');
  assert(start >= 0); assert(start < source.indexOf('await seedLocalUiFixtures()'));
  assert(source.indexOf('return { result, evidenceDir };') > source.indexOf('finishDisposableCleanup(failure'));
  assert(source.indexOf("writeFileSync(resolve(evidenceDir, 'results.json')") > source.indexOf('}, { firestore: db });'));
  assert(source.includes('adminClientClosed: true, firestoreClientTerminated: true'));
  assert(!source.includes('process.exit('));
});
test('real SDK lifecycle regression keeps its unclosed control and natural success/error exits in CI', () => {
  const suite = readFileSync('scripts/qa/local-admin-lifecycle-suite.mjs', 'utf8');
  assert(suite.includes("['before', 'after', 'task-error']"));
  assert(suite.includes("assert(!outcome, 'Omitted client cleanup must reproduce the live process')"));
  assert(suite.includes("assert.equal(controller.signal.aborted, false, 'Natural exit must precede the deadline')"));
  const fixture = readFileSync('tests/fixtures/local-admin-client.mjs', 'utf8');
  assert(fixture.includes("await db.collection('users').limit(1).get()"));
  assert(fixture.includes("await getDatabase().ref('liveTrips').get()"));
  assert(fixture.includes('await db.terminate(); firestoreTerminationAcknowledged = true'));
  assert(fixture.includes('await deleteApp(app); appDeletionAcknowledged = true'));
  assert(!fixture.includes('process.exit('));
  for (const workflow of ['backend-ci.yml', 'web-integration-smoke.yml'])
    assert(readFileSync('.github/workflows/' + workflow, 'utf8').includes('npm run test:local-admin-lifecycle && node --test tests/local-admin-lifecycle.test.mjs'));
});
