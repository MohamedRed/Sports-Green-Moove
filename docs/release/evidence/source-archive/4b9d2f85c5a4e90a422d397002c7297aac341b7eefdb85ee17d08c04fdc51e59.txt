import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { childAccountPhonePhases, childAccountPhoneCollections, verifyChildAccountPhoneCheckpoint } from './child-account-phone-checkpoints.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? '') && process.stdin.isTTY);
assert.equal(statSync(sessionPath).mode & 0o077, 0); assert.equal(statSync(dirname(sessionPath)).mode & 0o077, 0);
const session = JSON.parse(readFileSync(sessionPath));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const { auth, db } = await import('./local-flow-client.mjs');
const { Timestamp } = await import('firebase-admin/firestore');
const { getDatabase } = await import('firebase-admin/database');
const { deleteApp } = await import('firebase-admin/app');
const { withLocalAdminCleanup } = await import('./local-admin-lifecycle.mjs');
mkdirSync(output, { mode: 0o700 });
const input = createInterface({ input: process.stdin, terminal: false }), checkpoints = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let baseline, previous, completed = false, failure, adminClientClosed = false, firestoreClientTerminated = false;
const canonical = value => {
  if (value instanceof Timestamp) return { seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, canonical(item)]));
  return value;
};
async function snapshot() {
  const names = [...new Set([...(await db.listCollections()).map(row => row.id), ...childAccountPhoneCollections])].sort();
  const documents = Object.fromEntries(await Promise.all(names.map(async name => [name,
    (await db.collection(name).orderBy('__name__').get()).docs.map(row => {
      const data = canonical(row.data());
      if (name === 'users' && [session.fixture.parentUid, session.fixture.childUid].includes(row.id)) delete data.updatedAt;
      return { id: row.id, data };
    })])));
  const users = await auth.listUsers(1000); assert(!users.pageToken);
  return { documents, liveData: canonical((await getDatabase().ref('/').get()).val()),
    claims: users.users.map(row => ({ uid: row.uid, claims: row.customClaims ?? {} })).sort((a, b) => a.uid.localeCompare(b.uid)) };
}
try {
  await withLocalAdminCleanup(async () => {
    baseline = await snapshot(); assert.deepEqual(await snapshot(), baseline, 'Fixture preparation is not stable');
    verifyChildAccountPhoneCheckpoint('child-signed-in', baseline, baseline, session.fixture);
    writeFileSync(resolve(output, 'baseline.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
      fixture: session.fixture, baseline }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log('Read-only child-account observer ready. Enter: ' + childAccountPhonePhases.join(', ') + ', finish.');
    for await (const command of input) {
      const phase = command.trim(); if (phase === 'stop') break;
      if (phase === 'finish') { assert.equal(checkpoints.length, childAccountPhonePhases.length); completed = true; break; }
      assert.equal(phase, childAccountPhonePhases[checkpoints.length], 'Observe each phone checkpoint once, in order');
      const state = await snapshot(); const result = verifyChildAccountPhoneCheckpoint(phase, baseline, state, session.fixture, previous);
      writeFileSync(resolve(output, phase + '.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
        recordedAt: new Date().toISOString(), state, result }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      previous = state; checkpoints.push(result); console.log('Independent child-account checkpoint passed: ' + phase);
    }
  }, { firestore: { terminate: async () => { await db.terminate(); firestoreClientTerminated = true; } },
    closeApp: async app => { await deleteApp(app); adminClientClosed = true; } });
} catch (error) { failure = error; }
finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;
}
const paths = ['scripts/qa/manual-child-account-phone-session.mjs', 'scripts/qa/child-account-phone-checkpoints.mjs',
  ...(session.fixtureProvenance === 'isolated-browser-created-child' ?
    ['scripts/qa/child-invitation-browser-runtime.mjs', 'scripts/qa/start-child-invitation-browser.mjs'] :
    ['scripts/qa/child-account-phone-fixture.mjs', 'scripts/qa/child-account-phone-runtime.mjs', 'scripts/qa/start-child-account-phone.mjs'])];
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), scope: 'independent-child-account-phone-records-not-ui-proof',
  completed: completed && !failure, checkpoints, adminClientClosed, firestoreClientTerminated,
  productionWrites: false, physicalUiProvenByThisReport: false, signupProven: false, trackingProven: false,
  fixtureProvenance: session.fixtureProvenance ?? 'preseeded-isolated-child-account',
  sourceFiles: Object.fromEntries(paths.map(file => [file,
    createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')])),
}, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Child-account observer closed; dispose of the phone, helper and owned environment separately.');
