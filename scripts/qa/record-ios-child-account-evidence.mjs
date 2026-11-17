import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {iosBuildInputPaths, iosAutomatedEvidenceIds, validateIosFixtureGate} from './ios-fixture-release-evidence.mjs';

const root = resolve(import.meta.dirname, '../..'), folder = 'docs/release/evidence/ios-child-account-2026-11-06';
const output = resolve(root, folder), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => readFileSync(resolve(root, path)), json = value => JSON.stringify(value, null, 2) + '\n';
const [nativePath, signaturesPath] = process.argv.slice(2);
assert(nativePath?.startsWith('/') && signaturesPath?.startsWith('/'));
const native = readFileSync(nativePath), signatures = readFileSync(signaturesPath);
for (const text of ['ChildAccountWireChecks passed:', '34 malformed response rejections', 'ChildAccountStateChecks passed:',
  'ChildAccountBoundaryChecks passed: 70', 'SportsGreenMooveNativeChecks passed', 'OwnedPlacesAdapterChecks passed']) assert(native.includes(text));
assert(signatures.includes('Owned callable signature checks passed'));
const beforePath = 'docs/release/evidence/ios-automated-acceptance-6fb6487-2026-11-06/manifest-after.json';
const before = JSON.parse(read(beforePath)), afterBytes = read('docs/release/evidence-manifest.json'), after = JSON.parse(afterBytes);
for (const key of Object.keys(before).filter(key => key !== 'automatedUserFlowEvidence')) assert.deepEqual(after[key], before[key]);
const nonIos = rows => rows.filter(row => !iosAutomatedEvidenceIds.includes(row.id));
assert.deepEqual(nonIos(after.automatedUserFlowEvidence.items), nonIos(before.automatedUserFlowEvidence.items));
for (const id of iosAutomatedEvidenceIds) {
  const prior = before.automatedUserFlowEvidence.items.find(row => row.id === id), current = after.automatedUserFlowEvidence.items.find(row => row.id === id);
  assert.equal(prior.status, 'passed'); assert.equal(current.status, 'pending');
  assert.deepEqual({...current, status: prior.status, description: prior.description}, prior);
  assert.throws(() => validateIosFixtureGate(root, prior.fixtureGateProof), /Untested iPhone input/);
}
const checkedAt = new Date().toISOString(), indexName = `automated-user-flow-evidence-${checkedAt.replace(/[:.]/g, '')}-ios-child-inputs.json`;
const evidence = resolve(root, 'docs/release/evidence');
const priorName = readdirSync(evidence).filter(name => /^automated-user-flow-evidence-.*\.json$/.test(name)).sort().at(-1);
assert(priorName && indexName > priorName);
const priorBytes = read('docs/release/evidence/' + priorName), index = JSON.parse(priorBytes);
index.items = index.items.map(row => iosAutomatedEvidenceIds.includes(row.id) ? after.automatedUserFlowEvidence.items.find(item => item.id === row.id) : row);
assert.deepEqual(nonIos(index.items), nonIos(JSON.parse(priorBytes).items));
index.inheritedEvidence = {source: 'docs/release/evidence/' + priorName, sha256: sha(priorBytes)};
index.updatedAt = checkedAt; index.iosInputChange = {source: folder + '/summary.json', reason: 'child-account-invitation-and-parent-approval'};
mkdirSync(output, {recursive: true}); assert(!existsSync(resolve(output, 'summary.json')));
const records = [];
function record(file, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(json(value));
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes));
  writeFileSync(resolve(output, file), bytes, {flag: 'wx'}); records.push({file, sha256: sha(bytes)});
}
record('native-checks.log', native); record('signature-checks.log', signatures);
record('manifest-before.json', read(beforePath)); record('manifest-after.json', afterBytes); record('index-after.json', index);
record('build-input-sha256.json', {files: iosBuildInputPaths(root).map(path => ({path, sha256: sha(read(path))}))});
record('summary.json', {schemaVersion: 1, checkedAt: checkedAt.slice(0, 10), recordedAt: checkedAt,
  nativePlanExitCode: 0, signaturesExitCode: 0, malformedResponsesRejected: 34, delayedBoundaries: 70,
  originalFixtureCases: 11, extraFixtureCases: 0, existingCaseExtensions: 2, deadlineMinutes: 50,
  onlyIosAcceptanceReopened: true, priorSuccessAndFailureReferencesPreserved: true,
  sdkLinkedBuildAccepted: false, fixtureUiExecuted: false, systemShareExecuted: false,
  connectedChildSignupAccepted: false, physicalDeviceAccepted: false, releaseComplete: false, records: [...records]});
writeFileSync(resolve(evidence, indexName), json(index), {flag: 'wx'});
console.log(JSON.stringify({source: folder + '/summary.json', sha256: sha(read(folder + '/summary.json')), index: indexName}));
