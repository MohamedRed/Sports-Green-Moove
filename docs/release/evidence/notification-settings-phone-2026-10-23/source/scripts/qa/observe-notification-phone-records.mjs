import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { deleteApp, getApp } from 'firebase-admin/app';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? '')); assert(process.stdin.isTTY);
assert.equal(statSync(sessionPath).mode & 0o077, 0);
const session = JSON.parse(readFileSync(sessionPath));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const { auth, db, signIn, call } = await import('./local-flow-client.mjs');
mkdirSync(output, {mode: 0o700});
const phases = ['initial', 'first-return', 'second-return', 'restored'], checkpoints = [];
const input = createInterface({input: process.stdin, terminal: false});
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
const records = async () => {
  const result = new Map();
  for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) result.set(row.ref.path, row.data());
  return result;
};
let completed = false, failure, count = 0;
try {
  const parent = await signIn(session.parent);
  await call('initializeUserProfile', parent);
  const baseline = await records(), claims = (await auth.getUser(parent.uid)).customClaims;
  count = baseline.size;
  console.log('Read-only account observer ready. Enter observed phone stages: ' + phases.join(', '));
  for await (const command of input) {
    const phase = command.trim(); if (phase === 'stop') break;
    if (phase === 'finish') { assert.equal(checkpoints.length, phases.length); completed = true; break; }
    assert.equal(phase, phases[checkpoints.length]);
    const current = await records(); assert.deepEqual([...current.keys()].sort(), [...baseline.keys()].sort());
    for (const [path, before] of baseline) {
      const after = current.get(path);
      if (path === `users/${parent.uid}`) {
        const {updatedAt: oldTime, ...oldFields} = before, {updatedAt: newTime, ...newFields} = after;
        assert(newTime.toMillis() >= oldTime.toMillis()); assert.deepEqual(newFields, oldFields, path);
      } else assert.deepEqual(after, before, path);
    }
    assert.deepEqual((await auth.getUser(parent.uid)).customClaims, claims);
    const result = {phase, recordedAt: new Date().toISOString(), recordCount: count, originalRecordsUnchanged: true,
      originalClaimsUnchanged: true, osPermissionProvenByThisObserver: false, pushDeliveryAccepted: false};
    writeFileSync(resolve(output, phase + '.json'), JSON.stringify(result, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
    checkpoints.push(result); console.log('Independent records unchanged: ' + phase);
  }
} catch (error) { failure = error; }
finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  await deleteApp(getApp()); delete process.env.SGM_QA_PASSWORD;
}
const paths = ['scripts/qa/observe-notification-phone-records.mjs',
  ...['services/AndroidNotificationSettings', 'ui/NotificationSettingsState', 'ui/NotificationSettingsRow', 'ui/ProfileSettingsCard',
    'ui/ProfileScreen', 'ui/OptionsScreen'].map(file => 'android/app/src/main/java/be/sportgreenmoove/app/' + file + '.kt')];
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), completed: completed && !failure, checkpoints, originalRecordCount: count,
  scope: 'independent-local-account-integrity-not-phone-permission-or-delivery-proof', adminClientClosed: true,
  productionWrites: false, osPermissionProvenByThisObserver: false, pushDeliveryAccepted: false,
  sourceFiles: Object.fromEntries(paths.map(file => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))},
null, 2) + '\n', {mode: 0o600, flag: 'wx'});
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Read-only account observer closed; destroy its owned isolated environment separately.');
