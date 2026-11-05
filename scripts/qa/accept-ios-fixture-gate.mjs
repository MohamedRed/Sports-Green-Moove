import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {assertCurrentIosAutomatedEvidence, iosAutomatedEvidenceIds, validateIosFixtureGate} from './ios-fixture-release-evidence.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
export function acceptIosFixtureGate(root, source) {
  assert(source?.startsWith('docs/release/evidence/'));
  const reference = {source, sha256: sha(readFileSync(resolve(root, source)))};
  const proof = validateIosFixtureGate(root, reference);
  const manifestPath = resolve(root, 'docs/release/evidence-manifest.json'), originalManifest = readFileSync(manifestPath);
  const manifest = JSON.parse(originalManifest), before = structuredClone(manifest), evidence = resolve(root, 'docs/release/evidence');
  const priorName = readdirSync(evidence).filter(name => /^automated-user-flow-evidence-.*\.json$/.test(name)).sort().at(-1);
  assert(priorName); const priorPath = resolve(evidence, priorName), priorBytes = readFileSync(priorPath), prior = JSON.parse(priorBytes);
  const indexPath = resolve(evidence, `automated-user-flow-evidence-${proof.checkedAt}.json`); assert(!existsSync(indexPath));
  const receiptFolder = resolve(evidence, `ios-automated-acceptance-${proof.sourceCommit.slice(0, 7)}-${proof.checkedAt}`);
  assert(!existsSync(receiptFolder));
  const proofFolder = source.replace(/\/summary\.json$/, '').replace('docs/release/', '');
  const url = `https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/${proof.runId}/job/${proof.jobId}`;
  for (const row of manifest.automatedUserFlowEvidence.items.filter(row => iosAutomatedEvidenceIds.includes(row.id))) {
    row.status = 'passed'; row.fixtureGateProof = reference; row.appSourceCommit = proof.sourceCommit; row.verifiedAt = proof.checkedAt;
    row.description = row.id === 'ios_sdk_build_ci' ?
      `SDK-linked app and all fixture bundles compile successfully at ${proof.sourceCommit.slice(0, 7)}. Exact current build inputs and unchanged workflow jobs match the successful source. Simulator-only automated acceptance; no physical or real-service acceptance.` :
      `All eleven original fixture screen cases and disposal pass at ${proof.sourceCommit.slice(0, 7)}, with no artifacts. Exact source, resources, case inventory and terminal transcript are retained. This does not accept physical, operational, emergency phone handoff or complete release flows.`;
    row.evidenceRefs = [...new Set([proofFolder + '/summary.json', proofFolder + '/source-sha256.json',
      proofFolder + '/build-input-sha256.json', url, ...row.evidenceRefs])];
  }
  manifest.generatedAt = proof.checkedAt;
  assert.equal(manifest.manifestStatus, 'in-progress'); assertCurrentIosAutomatedEvidence(manifest, {root});
  for (const key of Object.keys(before).filter(key => !['generatedAt', 'automatedUserFlowEvidence'].includes(key)))
    assert.deepEqual(manifest[key], before[key]);
  const nonIos = value => value.filter(row => !iosAutomatedEvidenceIds.includes(row.id));
  assert.deepEqual(nonIos(manifest.automatedUserFlowEvidence.items), nonIos(before.automatedUserFlowEvidence.items));
  const index = structuredClone(prior);
  index.items = index.items.map(row => iosAutomatedEvidenceIds.includes(row.id) ?
    structuredClone(manifest.automatedUserFlowEvidence.items.find(item => item.id === row.id)) : row);
  index.inheritedEvidence = {source: 'docs/release/evidence/' + priorName, sha256: sha(priorBytes)};
  index.updatedAt = proof.checkedAt; index.iosFixtureGateProof = reference;
  assert.deepEqual(nonIos(index.items), nonIos(prior.items));
  assert.deepEqual(readFileSync(manifestPath), originalManifest); assert.deepEqual(readFileSync(priorPath), priorBytes);
  mkdirSync(receiptFolder);
  writeFileSync(resolve(receiptFolder, 'manifest-before.json'), originalManifest, {flag: 'wx'});
  writeFileSync(resolve(receiptFolder, 'manifest-after.json'), json(manifest), {flag: 'wx'});
  writeFileSync(resolve(receiptFolder, 'index-after.json'), json(index), {flag: 'wx'});
  writeFileSync(resolve(receiptFolder, 'summary.json'), json({checkedAt: proof.checkedAt, sourceCommit: proof.sourceCommit,
    fixtureGateProof: reference, manifestBeforeSha256: sha(originalManifest), manifestAfterSha256: sha(json(manifest)),
    inheritedIndex: index.inheritedEvidence, indexAfterSha256: sha(json(index)), acceptedIds: iosAutomatedEvidenceIds,
    allOtherManifestSectionsPreserved: true, allOtherAutomatedEntriesPreserved: true,
    physicalDeviceAccepted: false, operationalEvidenceAccepted: false, releaseComplete: false}), {flag: 'wx'});
  writeFileSync(indexPath, json(index), {flag: 'wx'}); writeFileSync(manifestPath, json(manifest));
  return {sourceCommit: proof.sourceCommit, accepted: iosAutomatedEvidenceIds,
    currentBuildInputsMatched: true, previousEvidencePreserved: true, releaseComplete: false};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(JSON.stringify(acceptIosFixtureGate(resolve(import.meta.dirname, '../..'), process.argv[2])));
