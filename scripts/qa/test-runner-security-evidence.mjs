import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const testRunnerSecurityFolder = 'docs/release/evidence/test-runner-security-2026-10-30/';
export function validateTestRunnerSecurity(root) {
  const directory = resolve(root, testRunnerSecurityFolder);
  const bytes = name => readFileSync(resolve(directory, name));
  const json = name => JSON.parse(bytes(name));
  const text = name => bytes(name).toString().replace(/\x1b\[[0-9;]*m/g, '');
  const hashes = json('artifact-sha256.json');
  assert.equal(Object.keys(hashes).length, 31);
  for (const [name, hash] of Object.entries(hashes)) {
    assert.match(name, /^[\w.-]+(?:\/[\w.-]+)*$/);
    assert(!name.split('/').includes('..'));
    assert.equal(createHash('sha256').update(bytes(name)).digest('hex'), hash);
  }
  const before = json('audit-before.json'), after = json('audit-after.json');
  assert.deepEqual(before.metadata.vulnerabilities, { info: 0, low: 0, moderate: 19, high: 12, critical: 2, total: 33 });
  assert.deepEqual(after.metadata.vulnerabilities, { info: 0, low: 0, moderate: 18, high: 12, critical: 0, total: 30 });
  for (const name of ['tinypool', 'vitest', '@vitest/mocker']) {
    assert(before.vulnerabilities[name]); assert.equal(after.vulnerabilities[name], undefined);
  }
  const old = json('lock-before.json'), current = json('lock-after.json');
  assert.equal(old.packages['node_modules/tinypool'].version, '1.1.1');
  assert.equal(old.packages['node_modules/vitest'].version, '3.2.6');
  assert.equal(current.packages['node_modules/vitest'].version, '4.1.12');
  assert.equal(current.packages['node_modules/@vitest/mocker'].version, '4.1.12');
  const { devDependencies: oldDev, ...oldFunctions } = old.packages.functions;
  const { devDependencies: newDev, ...newFunctions } = current.packages.functions;
  assert.deepEqual(newFunctions, oldFunctions);
  assert.deepEqual(newDev, { ...oldDev, vitest: '^4.1.12' });
  assert(!Object.keys(current.packages).some(path => /(?:^|\/)node_modules\/tinypool$/.test(path)));
  for (const path of Object.keys(old.packages)) {
    if (path !== 'functions' && old.packages[path].version === current.packages[path]?.version)
      assert.deepEqual(current.packages[path], old.packages[path], `Unrelated metadata changed: ${path}`);
  }
  assert.match(text('regression-before.txt'), /# pass 0\n# fail 4/);
  assert.equal((text('regression-before.txt').match(/actual: true/g) ?? []).length, 3);
  assert.match(text('contracts-after.txt'), /# fail 0/);
  assert.match(text('functions-after.txt'), /Tests\s+547 passed \(547\)/);
  assert.match(text('rules-java21-after.txt'), /Tests\s+208 passed \(208\)/);
  assert.match(text('rules-initial-failed.txt'), /no longer supports Java version before 21/);
  assert(!text('rules-initial-failed.txt').includes('Tests  '));
  assert.match(text('payments-after.txt'), /Tests\s+78 passed \(78\)/);
  assert.match(text('notifications-after.txt'), /Tests\s+19 passed \(19\)/);
  for (const file of ['functions-after.txt', 'rules-java21-after.txt', 'payments-after.txt', 'notifications-after.txt'])
    assert.match(text(file), /RUN\s+v4\.1\.12/);
  assert.match(text('root-after.txt'), /# tests 3000\n# suites 0\n# pass 3000\n# fail 0/);
  for (const name of ['functions', 'admin', 'website']) assert(text('build-after.txt').includes(`@sports-green-moove/${name}`));
  assert.match(text('clean-install.txt'), /added \d+ packages/);
  const summary = json('summary.json');
  assert.equal(summary.baseHead, '8fb8731bf129e041144602932d814e54f8cf6be7');
  assert.equal(summary.scope, 'local-test-runner-security-not-production-or-release-proof');
  for (const key of ['productionDeployed', 'runtimeCodeChanged', 'physicalFlowAccepted', 'releaseComplete', 'cleanAudit'])
    assert.equal(summary[key], false);
  const closure = json('endpoints-closed.json');
  assert.deepEqual(closure, { host: '127.0.0.1', ports: [4400, 4500, 5001, 8080, 9000, 9099, 9150, 9199], closed: true });
  const native = json('base-native-run.json');
  assert.equal(native.headSha, summary.baseHead); assert.equal(native.status, 'completed');
  assert.equal(native.conclusion, 'failure');
  const main = native.jobs.find(job => job.databaseId === 124088103015);
  assert.equal(main.name, 'Android native UI tests'); assert.equal(main.conclusion, 'failure');
  assert.equal(main.steps.find(step => step.name === 'Run Android Compose UI tests').conclusion, 'failure');
  const aggregate = native.jobs.find(job => job.name === 'Android focused safety UI tests / Isolated safety flows');
  assert.equal(aggregate.conclusion, 'success');
  const focused = native.jobs.filter(job => job.name.startsWith('Android focused safety UI tests /') && job !== aggregate);
  assert.equal(focused.length, 11); assert(focused.every(job => job.conclusion === 'success'));
  const artifact = json('base-native-artifact.json');
  assert.equal(artifact.id, 12981493483); assert.equal(artifact.expired, false);
  assert.equal(artifact.digest, 'sha256:b7c2a869420e4d248e8f4be4c4323ffae71a93fd63a180e17963be97331f54f4');
  const ordinary = json('base-native/ordinary-results.json');
  assert.equal(ordinary.caseCount, 257); assert.equal(ordinary.passed, 202);
  assert.equal(ordinary.skipped, 54); assert.equal(ordinary.failed, 1);
  assert.equal(ordinary.cases.find(row => row.status === 'failed').name, 'largeTextParentSeesBothVersionsAndAcceptsWithoutApplying');
  assert.match(text('base-native/ordinary-instrumentation.txt'), /Failed waiting for PixelCopy!/);
  for (const [name, count] of [['RejectedPrimaryBitmapTest', 4], ['TeamConversationFlowTest', 3]]) {
    const cases = ordinary.cases.filter(row => row.className.endsWith(`.${name}`));
    assert.equal(cases.length, count); assert(cases.every(row => row.status === 'passed'));
  }
  assert.deepEqual(json('base-native/native-suite-status.json'), {
    scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 1, componentEvidence: 0, localReplay: 1 });
  assert.equal(json('base-native/rejected-primary-copy.json').collectionStatus, 'not-observed');
  const capture = json('base-native/parent-capture-diagnostic.json');
  assert.equal(capture.schemaVersion, 3); assert.equal(capture.sdkInvocations, 1);
  assert.equal(capture.errorCategory, 'pixelcopy-callback-wait'); assert.equal(capture.primaryElapsedMs, 1069);
  assert.deepEqual(capture.samples.map(sample => sample.atMs), [259]);
  assert(capture.sampleScheduleMs.slice(1).every(offset => offset > capture.elapsedMs));
  const pull = json('base-native/adb-pull-parent-confirmation.json');
  assert.equal(pull.phase, 'trip-change-parent-confirmation'); assert.equal(pull.status, 1); assert.equal(pull.completed, false);
  assert(pull.hostAfter.daemonEvents.events.some(event => event.kind === 'connection-terminated-read-failed'));
  assert.match(text('base-native/parent-confirmation-instrumentation.txt'), /OK \(1 test\)/);
  return { criticalFindings: 0, totalFindings: 30, releaseComplete: false };
}
