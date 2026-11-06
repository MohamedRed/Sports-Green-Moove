import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateIosFixtureRecheck} from './ios-fixture-recheck.mjs';
import {assertCurrentIosAutomatedEvidence, iosAutomatedEvidenceIds} from './ios-fixture-release-evidence.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
export function recordIosFixtureRecheck(root, source) {
  const reference = {source, sha256: sha(readFileSync(resolve(root, source)))};
  const report = validateIosFixtureRecheck(root, reference), evidence = resolve(root, 'docs/release/evidence');
  const manifestPath = resolve(root, 'docs/release/evidence-manifest.json'), beforeBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(beforeBytes), before = structuredClone(manifest);
  const priorName = readdirSync(evidence).filter(name => /^automated-user-flow-evidence-.*\.json$/.test(name)).sort().at(-1);
  assert(priorName); const priorBytes = readFileSync(resolve(evidence, priorName)), index = JSON.parse(priorBytes);
  const indexPath = resolve(evidence, `automated-user-flow-evidence-${report.checkedAt}T-${report.sourceCommit.slice(0, 7)}-recheck.json`);
  const receipt = resolve(evidence, `ios-recheck-recording-${report.sourceCommit.slice(0, 7)}-${report.checkedAt}`);
  assert(!existsSync(indexPath) && !existsSync(receipt));
  const url = `https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/${report.runId}/job/${report.jobId}`;
  for (const row of manifest.automatedUserFlowEvidence.items.filter(row => iosAutomatedEvidenceIds.includes(row.id))) {
    row.status = 'pending'; row.fixtureGateRecheck = reference; row.lastAttemptAt = report.checkedAt;
    row.description = row.id === 'ios_sdk_build_ci' ?
      `SDK build succeeds at ${report.sourceCommit.slice(0, 7)}, but the combined source-bound gate is pending after the later screen failure. Historical build and eleven-case success are retained, not inherited as current acceptance.` :
      `The later ${report.sourceCommit.slice(0, 7)} recheck executes eleven cases: ${report.passed} pass, ${report.failed} fail (${report.assertionFailures} assertion). Cause unconfirmed. Disposal succeeds; no artifacts. Historical success is not current repeatability, physical or release acceptance.`;
    row.evidenceRefs = [...new Set([source.replace('docs/release/', ''), url, ...row.evidenceRefs])];
  }
  assertCurrentIosAutomatedEvidence(manifest, {root}); assert.equal(manifest.manifestStatus, 'in-progress');
  for (const key of Object.keys(before).filter(key => key !== 'automatedUserFlowEvidence')) assert.deepEqual(manifest[key], before[key]);
  const nonIos = rows => rows.filter(row => !iosAutomatedEvidenceIds.includes(row.id));
  assert.deepEqual(nonIos(manifest.automatedUserFlowEvidence.items), nonIos(before.automatedUserFlowEvidence.items));
  index.items = index.items.map(row => iosAutomatedEvidenceIds.includes(row.id) ?
    structuredClone(manifest.automatedUserFlowEvidence.items.find(item => item.id === row.id)) : row);
  index.inheritedEvidence = {source: 'docs/release/evidence/' + priorName, sha256: sha(priorBytes)};
  index.updatedAt = report.checkedAt; index.iosFixtureGateRecheck = reference;
  mkdirSync(receipt);
  writeFileSync(resolve(receipt, 'manifest-before.json'), beforeBytes, {flag: 'wx'});
  writeFileSync(resolve(receipt, 'manifest-after.json'), json(manifest), {flag: 'wx'});
  writeFileSync(resolve(receipt, 'summary.json'), json({reference, manifestBeforeSha256: sha(beforeBytes),
    manifestAfterSha256: sha(json(manifest)), indexAfterSha256: sha(json(index)), inheritedEvidence: index.inheritedEvidence,
    onlyIosAcceptanceReopened: true, historicalProofsPreserved: true, releaseComplete: false}), {flag: 'wx'});
  writeFileSync(indexPath, json(index), {flag: 'wx'}); writeFileSync(manifestPath, json(manifest));
  return {status: 'pending', reference, passed: report.passed, failed: report.failed};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(JSON.stringify(recordIosFixtureRecheck(resolve(import.meta.dirname, '../..'), process.argv[2])));
