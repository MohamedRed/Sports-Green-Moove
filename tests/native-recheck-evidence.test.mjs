import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { validateNativeRecheck } from '../scripts/qa/native-recheck-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), directory = 'docs/release/evidence/native-recheck-588fb21-2026-10-20';
const json = file => JSON.parse(readFileSync(resolve(root, directory, file)));
const baseline = 'docs/release/evidence/native-independent-61dc4cb-2026-10-20/replay/results.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('the complete original replay, all raw executions, primary copies and device restoration validate at the dated commit', () => {
  const context = validateNativeRecheck(root, directory);
  assert.equal(context.sourceCommit, '588fb21381a5638b19464c499a72e643f2757327');
  assert.equal(context.fullSearchBookingVerified, false); assert.deepEqual(context.reviewedNewCaptures, []);
});
function bundle(t) {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-native-recheck-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  cpSync(resolve(root, directory), resolve(temp, directory), { recursive: true });
  for (const file of [baseline, ...Object.values(json('source-sha256.json')).map(hash =>
    'docs/release/evidence/source-archive/' + hash + '.txt')]) {
    mkdirSync(dirname(resolve(temp, file)), { recursive: true }); cpSync(resolve(root, file), resolve(temp, file));
  }
  const path = file => resolve(temp, directory, file);
  return { root: temp, read: file => JSON.parse(readFileSync(path(file))),
    write: (file, value) => writeFileSync(path(file), JSON.stringify(value, null, 2) + '\n'), path,
    rebind() {
      const hashes = json('artifact-sha256.json');
      for (const file of Object.keys(hashes)) hashes[file] = sha(readFileSync(path(file)));
      writeFileSync(path('artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n');
    } };
}
for (const [label, file, mutate] of [
  ['failed focused job', 'native-run.json', ci => { ci.jobs.find(job => job.name.endsWith('Isolated session-disconnect')).conclusion = 'failure'; }],
  ['incomplete full job', 'native-run.json', ci => { ci.jobs.find(job => job.databaseId === 118625101626).status = 'in_progress'; }],
  ['new search acceptance', 'retained-context.json', context => { context.fullSearchBookingVerified = true; }],
  ['physical promotion', 'retained-context.json', context => { context.physicalDevice = true; }],
  ['failed primary copy', 'adb-pull-trip-change-parent-confirmation.json', receipt => { receipt.status = 1; receipt.completed = false; }],
  ['missing native execution', 'results.json', report => { report.nativeCaseCount = 37; }],
  ['administrator left active', 'disposable-store-restore.json', receipt => { receipt.installAdmin.authorizationRemoved = false; }],
]) test(`${label} cannot inherit the pass even with rebound file hashes`, t => {
  const copy = bundle(t), value = copy.read(file); mutate(value); copy.write(file, value); copy.rebind();
  assert.throws(() => validateNativeRecheck(copy.root, directory));
});
test('a testcase failure cannot be concealed behind unchanged zero-failure XML summary attributes', t => {
  const copy = bundle(t), path = copy.path('ordinary-suite.xml');
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(readFileSync(path));
  parsed.testsuite.testcase.find(item => !Object.hasOwn(item, 'skipped')).failure = { '@_message': 'Synthetic contradiction' };
  writeFileSync(path, new XMLBuilder({ ignoreAttributes: false }).build(parsed)); copy.rebind();
  assert.throws(() => validateNativeRecheck(copy.root, directory));
});
test('the portal records the later scoped pass without deleting failed history or accepting search/payment/phone gaps', () => {
  assert.equal(content.nativeVerification.recheck.manifest, directory + '/retained-context.json');
  assert(content.updates.some(item => item.title === 'Le dernier essai complet passe'));
  assert(content.updates.some(item => item.title === 'Le dernier essai complet ne démarre pas'));
  assert.equal(content.flows.find(flow => flow.id === 'search').status, 'partial');
  assert.equal(content.flows.find(flow => flow.id === 'payments').status, 'partial');
  assert.match(content.blockers.find(blocker => blocker.id === 'test-device-stability').next, /sur téléphone/);
});
