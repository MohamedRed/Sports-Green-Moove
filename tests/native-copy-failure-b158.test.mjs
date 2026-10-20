import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { content } from '../partner-portal/content.mjs';

const relative = 'docs/release/evidence/native-copy-failure-b158a75-2026-10-20/';
const base = new URL('../' + relative, import.meta.url);
const read = name => readFileSync(new URL(name, base));
const json = name => JSON.parse(read(name));

test('later failed primary copy stays negative despite a passing native action and successful cleanup copy', () => {
  const hashes = json('artifact-sha256.json');
  assert.deepEqual(Object.keys(hashes).sort(), readdirSync(base).filter(name => !['artifact-sha256.json', 'README.md'].includes(name)).sort());
  for (const [name, expected] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(name)).digest('hex'), expected);
  const run = json('native-run.json');
  assert.equal(run.databaseId, 39426320715); assert.equal(run.headSha, 'b158a75cbf8724e9e5ab59497ab321f5920aaa9d');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  const main = run.jobs.find(job => job.databaseId === 118639683801); assert.equal(main.conclusion, 'failure');
  assert.equal(run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests / Isolated ') &&
    job.name !== 'Android focused safety UI tests / Isolated safety flows' && job.conclusion === 'success').length, 6);
  assert.deepEqual(json('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 1 });
  assert.equal(json('adb-pull-trip-change-inputs.json').completed, false);
  assert.equal(json('adb-pull-trip-change-inputs.json').status, 1);
  assert.equal(json('adb-pull-failure-cleanup.json').completed, true);
  assert.equal(json('disposable-store-restore.json').verified, true);
  assert(read('LocalTripChangeInputsFlowTest-instrumentation.txt').toString().includes('OK (1 test)'));
  const suite = new XMLParser({ ignoreAttributes: false }).parse(read('ordinary-suite.xml')).testsuite;
  assert.equal(suite['@_tests'], '172'); assert.equal(suite['@_failures'], '0'); assert.equal(suite['@_errors'], '0');
  const named = suite.testcase.find(row => row['@_name'] === 'tripSearchAndMonthButtonsExposeNamedButtonActions');
  assert(named && !Object.hasOwn(named, 'skipped') && !Object.hasOwn(named, 'failure'));
  const paid = suite.testcase.find(row => row['@_name'] === 'parentSearchesAndRequestsTwoSeatsThenDriverApprovesAndParentCancelsInApp');
  assert(paid && Object.hasOwn(paid, 'skipped'));
  const overview = content.blockers.find(row => row.id === 'test-device-stability').source;
  assert(readFileSync(new URL('../' + overview, import.meta.url), 'utf8').includes('native-copy-failure-b158a75-2026-10-20'));
  assert(!read('README.md').toString().includes('root cause fixed'));
});
