import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { validateSessionRestorationReport, validateSessionRestorationProxy,
  validateRetainedSessionRestoration, publishedSessionRestorationCaptures } from '../scripts/qa/session-restoration-retained-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..');
const directory = 'docs/release/evidence/session-restoration-native-2026-10-20';
const source = directory + '/session-restoration-results.json';
const json = file => JSON.parse(readFileSync(resolve(root, directory, file)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('the retained app, SDK requests, rotations, original images and independent disposal validate together', () => {
  const report = validateRetainedSessionRestoration(root, source);
  assert.equal(report.testedAt.slice(0, 10), '2026-10-20');
  assert.equal(report.fixtureIsolation.accountCount, 5);
  assert.equal(report.physicalDevice, false); assert.equal(report.realNetworkLossVerified, false);
});
test('local scope cannot be promoted by removing failures, cleanup or remaining boundaries', () => {
  for (const [key, value] of [['failureSurvivedRotation', false], ['parentSignedOut', false], ['proxyClosed', false],
    ['orientationRestored', false], ['isolatedEnvironmentDestroyed', false], ['realNetworkLossVerified', true],
    ['physicalDevice', true], ['storeReviewAccepted', true], ['restorationAttempts', 3]]) {
    const report = json('session-restoration-results.json'); report[key] = value;
    assert.throws(() => validateSessionRestorationReport(report), key);
  }
});
test('extra requests, wrong identities or successful initial requests cannot masquerade as the trial', () => {
  const report = json('session-restoration-results.json');
  for (const mutate of [proxy => proxy.attempts.push(proxy.attempts[0]), proxy => { proxy.uid = 'sgm-qa-driver'; },
    proxy => { proxy.attempts[0].downstreamStatus = 200; }, proxy => { proxy.failed = true; }]) {
    const proxy = json('session-restoration-proxy.json'); mutate(proxy);
    assert.throws(() => validateSessionRestorationProxy(report, proxy));
  }
});

function copiedBundle(t) {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-session-retained-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  cpSync(resolve(root, directory), resolve(temp, directory), { recursive: true });
  for (const hash of Object.values(json('session-restoration-results.json').sourceFiles)) {
    const file = 'docs/release/evidence/source-archive/' + hash + '.txt';
    mkdirSync(dirname(resolve(temp, file)), { recursive: true }); cpSync(resolve(root, file), resolve(temp, file));
  }
  return { root: temp,
    read: file => JSON.parse(readFileSync(resolve(temp, directory, file))),
    write: (file, value) => writeFileSync(resolve(temp, directory, file), JSON.stringify(value, null, 2) + '\n'),
    rebind() {
      const hashes = json('artifact-sha256.json');
      for (const file of Object.keys(hashes)) hashes[file] = sha(readFileSync(resolve(temp, directory, file)));
      writeFileSync(resolve(temp, directory, 'artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n');
    } };
}
for (const [label, mutate] of [
  ['failed selected CI job', bundle => {
    const ci = bundle.read('native-ci-run.json');
    ci.jobs.find(job => job.databaseId === 118604032135).conclusion = 'failure'; bundle.write('native-ci-run.json', ci);
  }],
  ['marker disagreement', bundle => {
    const marker = bundle.read('local-session-restoration-device.json'); marker.profileIdentityVerified = false;
    bundle.write('local-session-restoration-device.json', marker);
  }],
  ['missing raw case status', bundle => {
    const status = bundle.read('session-restoration-suite-status.json'); status.status = 1;
    bundle.write('session-restoration-suite-status.json', status);
  }],
  ['wrong source commit', bundle => {
    const ci = bundle.read('native-ci-run.json'); ci.headSha = 'a'.repeat(40); bundle.write('native-ci-run.json', ci);
    const context = bundle.read('retained-context.json'); context.sourceCommit = ci.headSha; bundle.write('retained-context.json', context);
  }],
]) test(`${label} is rejected even after the file checksum manifest is rebound`, t => {
  const bundle = copiedBundle(t); mutate(bundle); bundle.rebind();
  assert.throws(() => validateRetainedSessionRestoration(bundle.root, source));
});
test('the recovery tour keeps four original captures and the separately verified disconnect flow stays local-only', () => {
  const flow = content.flows.find(item => item.id === 'session-restoration');
  assert.equal(flow.status, 'partial'); assert.equal(flow.ui.source, source);
  assert.equal(flow.images.filter(row => !row.file.startsWith('session-current-')).length, 8); assert.equal(flow.tour.length, 4);
  const historical = flow.images.filter(item => item.file.startsWith('session-recovery-'));
  assert.deepEqual(historical.map(item => captures[item.file].split('/').at(-1)), publishedSessionRestorationCaptures);
  assert.deepEqual(historical.map(item => item.landscape), [false, true, true, false]);
  assert.match(flow.remaining, /vraie coupure/);
  const disconnect = content.flows.find(item => item.id === 'session-disconnect');
  assert.equal(disconnect.status, 'partial'); assert.match(disconnect.remaining, /vraie coupure/);
});
