import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { validateSessionDisconnectReport, validateRetainedSessionDisconnect } from '../scripts/qa/session-disconnect-retained-evidence.mjs';
import { sessionDisconnectCaptures } from '../scripts/qa/session-disconnect-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), directory = 'docs/release/evidence/session-disconnect-native-2026-10-20';
const source = directory + '/session-disconnect-results.json';
const json = file => JSON.parse(readFileSync(resolve(root, directory, file)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('two actual app processes, explicit disconnect, original captures and independent cleanup validate together', () => {
  const report = validateRetainedSessionDisconnect(root, source);
  assert.equal(report.testedAt.slice(0, 10), '2026-10-20'); assert.equal(report.nativeCaseCount, 2);
  assert.notEqual(report.preparedProcessId, report.processId); assert.equal(report.fixtureIsolation.accountCount, 5);
});
test('a local report cannot silently accept authentication, production scope or failed disposal', () => {
  for (const [key, value] of [['authEmptyBeforeLaunch', false], ['authEmptyAfterLaunch', false], ['proxyClosed', false],
    ['isolatedEnvironmentDestroyed', false], ['realNetworkLossVerified', true], ['physicalDevice', true],
    ['storeReviewAccepted', true], ['nativeCaseCount', 1]]) {
    const report = json('session-disconnect-results.json'); report[key] = value;
    assert.throws(() => validateSessionDisconnectReport(report), key);
  }
});
function bundle(t) {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-disconnect-retained-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  cpSync(resolve(root, directory), resolve(temp, directory), { recursive: true });
  for (const hash of Object.values(json('session-disconnect-results.json').sourceFiles)) {
    const file = 'docs/release/evidence/source-archive/' + hash + '.txt';
    mkdirSync(dirname(resolve(temp, file)), { recursive: true }); cpSync(resolve(root, file), resolve(temp, file));
  }
  return { root: temp, read: file => JSON.parse(readFileSync(resolve(temp, directory, file))),
    write: (file, value) => writeFileSync(resolve(temp, directory, file), JSON.stringify(value, null, 2) + '\n'),
    rebind() {
      const hashes = json('artifact-sha256.json');
      for (const file of Object.keys(hashes)) hashes[file] = sha(readFileSync(resolve(temp, directory, file)));
      writeFileSync(resolve(temp, directory, 'artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n');
    } };
}
for (const [label, file, mutate] of [
  ['failed selected job', 'native-ci-run.json', ci => { ci.jobs.find(job => job.databaseId === 118619147999).conclusion = 'failure'; }],
  ['foreign source commit', 'retained-context.json', context => { context.sourceCommit = 'a'.repeat(40); }],
  ['retained signed-in identity', 'local-session-disconnect-device.json', marker => { marker.authEmptyBeforeLaunch = false; }],
  ['no actual stop', 'local-session-disconnect-stop.json', marker => { marker.forceStopIssued = false; }],
  ['extra restoration request', 'session-disconnect-proxy.json', proxy => { proxy.attempts.push(proxy.attempts[0]); }],
  ['failed primary transfer', 'adb-pull-session-disconnect.json', receipt => { receipt.completed = false; receipt.status = 1; }],
  ['missing administrator restoration', 'disposable-device-restore.json', receipt => { receipt.restoration.installAdmin.authorizationRemoved = false; }],
  ['nonzero command exit', 'session-disconnect-suite-status.json', status => { status.status = 1; }],
]) test(`${label} is rejected even after the file checksum manifest is rebound`, t => {
  const copy = bundle(t), value = copy.read(file); mutate(value); copy.write(file, value); copy.rebind();
  assert.throws(() => validateRetainedSessionDisconnect(copy.root, source));
});
test('the partner tour uses three reviewed originals and does not promote the local run to physical acceptance', () => {
  const flow = content.flows.find(item => item.id === 'session-disconnect');
  assert.equal(flow.status, 'partial'); assert.equal(flow.ui.source, source);
  assert.equal(flow.images.length, 3); assert.equal(flow.tour.length, 3);
  assert.deepEqual(flow.images.map(item => captures[item.file].split('/').at(-1)), sessionDisconnectCaptures);
  assert.match(flow.remaining, /vraie coupure/); assert.match(flow.remaining, /pendant un trajet/);
});
