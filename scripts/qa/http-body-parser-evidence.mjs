import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const requestSafetyFolder = 'docs/release/evidence/http-body-parser-security-2026-10-28';
export function assertRequestSafetySummary(report) {
  assert.equal(report.checkedAt, '2026-10-28');
  assert.equal(report.scope, 'local-functions-resolved-parser-regression-not-production-incident-or-full-security-clearance');
  assert.match(report.baselineCommit, /^[a-f0-9]{40}$/);
  assert.equal(report.beforeVersion, '1.20.5'); assert.equal(report.afterVersion, '1.20.9');
  assert.equal(report.developmentParserBeforeVersion, '2.2.2'); assert.equal(report.developmentParserAfterVersion, '2.4.0');
  for (const flag of ['unchangedParserTestSources', 'applicationsBuilt', 'runtimeResourcesBoundedOnlyForTests', 'parserAuditFindingRemoved'])
    assert.equal(report[flag], true, flag);
  for (const flag of ['originalCliExitCauseProven', 'productionExploitReproduced', 'securityAuditClear', 'productionDeployed',
    'physicalDeviceAccepted', 'nativeReplayAccepted', 'releaseComplete', 'realPayments']) assert.equal(report[flag], false, flag);
  for (const [key, value] of Object.entries({parserCases: 9, parserFailuresBefore: 3, parserFailuresAfter: 0,
    localWorkerCrashesBefore: 2, backendUnitCasesPassed: 501, incompleteServiceGroupsPassed: 21,
    serviceGroupsTotal: 24, boundedServiceGroupsPassed: 24, disposalCasesPassed: 5, localJvmMaxHeapMiB: 512,
    auditFindingsBefore: 22, auditFindingsAfter: 21, providerMapRequests: 0})) assert.equal(report[key], value, key);
}

export function validateRequestSafetyEvidence(root, record) {
  const base = dirname(resolve(root, record.source)), bytes = name => readFileSync(resolve(base, name));
  const json = name => JSON.parse(bytes(name)), report = json('summary.json');
  assertRequestSafetySummary(report); assertEvidenceBundleChecksums(base);
  assert.equal(record.checkedAt, report.checkedAt); assert.equal(record.checksums, dirname(record.source) + '/artifact-sha256.json');
  const cases = name => new XMLParser({ignoreAttributes: false}).parse(bytes(name)).testsuites.testcase;
  const before = cases('parser-before.xml'), after = cases('parser-after.xml');
  assert.equal(before.length, 9); assert.deepEqual(before.map(c => c['@_name']), after.map(c => c['@_name']));
  const failures = before.filter(c => c.failure); assert.equal(failures.length, 3);
  assert.match(failures[0].failure['@_message'], /Missing expected exception/);
  for (const failure of failures.slice(1)) assert.match(failure.failure['@_message'], /Unhandled.*error.*Gunzip.*Z_DATA_ERROR/s);
  assert(after.every(c => !c.failure));
  const disposal = cases('disposal-tests.xml'); assert.equal(disposal.length, 5); assert(disposal.every(c => !c.failure));
  const oldLock = json('lock-before.json').packages, nextLock = json('lock-after.json').packages;
  assert.equal(oldLock['node_modules/body-parser'].version, report.beforeVersion);
  assert.equal(nextLock['node_modules/body-parser'].version, report.afterVersion);
  const dev = 'node_modules/@modelcontextprotocol/sdk/node_modules/';
  assert.equal(oldLock[dev + 'body-parser'].version, report.developmentParserBeforeVersion);
  assert.equal(nextLock[dev + 'body-parser'].version, report.developmentParserAfterVersion);
  const changed = [...new Set([...Object.keys(oldLock), ...Object.keys(nextLock)])]
    .filter(key => JSON.stringify(oldLock[key]) !== JSON.stringify(nextLock[key])).sort();
  assert.deepEqual(changed, [dev + 'body-parser', dev + 'body-parser/node_modules/content-type', dev + 'iconv-lite', dev + 'qs',
    'node_modules/body-parser', 'node_modules/body-parser/node_modules/qs'].sort());
  const oldAudit = json('audit-before.json'), newAudit = json('audit-after.json');
  assert(oldAudit.vulnerabilities['body-parser'].via.some(item => item.url?.endsWith('GHSA-27r3-jxmh-p828')));
  assert.equal(newAudit.vulnerabilities['body-parser'], undefined);
  assert.equal(oldAudit.metadata.vulnerabilities.total, 22); assert.equal(newAudit.metadata.vulnerabilities.total, 21);
  const first = json('incomplete-services.json'), fresh = json('bounded-services.json');
  assert.equal(first.projectId, 'demo-sgm-local-qa'); assert.equal(fresh.projectId, first.projectId); assert.notEqual(first.runId, fresh.runId);
  assert.equal(first.steps.filter(step => step.status === 'passed').length, 21);
  assert.deepEqual(first.steps.filter(step => step.status === 'failed').map(step => step.id),
    ['trip-change-parent-confirmation', 'trip-change-application', 'trip-change-supplement']);
  assert.equal(fresh.steps.length, 24); assert(fresh.steps.every(step => step.status === 'passed'));
  assert(Date.parse(fresh.testedAt) > Date.parse(first.testedAt));
  for (const file of ['incomplete-disposal.json', 'bounded-disposal.json']) {
    const result = json(file); assert.equal(result.endpoints.closed, true);
    assert.deepEqual(result.endpoints.ports, [5001, 8080, 9000, 9099]);
  }
  const initial = json('incomplete-disposal.json');
  assert.equal(initial.underlyingCliExitCode, 2); assert.equal(initial.rootCauseOfCliExitProven, false);
  assert.deepEqual(initial.unexpectedJavaProcesses, [75716, 75717]);
  assert.equal(initial.manualSignal, 'SIGTERM'); assert(initial.observedProcesses.every(row => row.absent));
  assert.equal(json('bounded-disposal.json').commandExitCode, 0);
  assert.match(bytes('backend-units.txt').toString(), /501 passed \(501\)/);
  assert.match(bytes('bounded-completion.txt').toString(), /24\/24 groups passed/);
  assert.match(bytes('bounded-completion.txt').toString(), /Script exited successfully \(code 0\)/);
  assertRetainedSourceFiles(root, json('source-files.json')); return report;
}
