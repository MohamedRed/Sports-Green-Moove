import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function validateChildDiscoveryCiFailure(root) {
  const folder = 'docs/release/evidence/child-contact-discovery-ci-2026-10-26/';
  const read = file => readFileSync(resolve(root, folder, file));
  const ordinary = JSON.parse(read('ordinary-results.json'));
  assert.equal(ordinary.complete, true); assert.equal(ordinary.guardConfirmed, true);
  assert.deepEqual([ordinary.caseCount, ordinary.passed, ordinary.skipped, ordinary.failed], [224, 169, 54, 1]);
  const failed = ordinary.cases.filter(row => row.status === 'failed');
  assert.deepEqual(failed.map(row => [row.className, row.name]), [['be.sportgreenmoove.app.ui.ChildRideEmergencyFlowTest',
    'settingsEntryWithoutARideDoesNotReadOrManageTheChildContact']]);
  const permission = ordinary.cases.filter(row => row.className === 'be.sportgreenmoove.app.ui.ChildEmergencyPermissionFlowTest');
  assert.equal(permission.length, 2); assert(permission.every(row => row.status === 'passed'));
  assert.equal(ordinary.productionWritesAccepted, false); assert.equal(ordinary.physicalDeviceAccepted, false);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(read('ordinary-tests.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 224); assert.equal(Number(suite['@_failures']), 1);
  assert.equal(JSON.parse(read('native-suite-status.json')).ordinaryTests, 1);
  const source = JSON.parse(read('source.json'));
  assert.equal(source.head, '61d1294e934005edd0e16c6b5086200cf684b71c');
  assert.equal(source.runId, 40314940529); assert.equal(source.jobId, 121545058155);
  assert.equal(source.conclusion, 'failure'); assertRetainedSourceFiles(root, source.sourceFiles);
  const hashes = JSON.parse(read('artifact-sha256.json'));
  assert.deepEqual(Object.keys(hashes).sort(), ['ordinary-results.json', 'ordinary-tests.xml', 'native-suite-status.json', 'source.json'].sort());
  for (const [file, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash);
}
