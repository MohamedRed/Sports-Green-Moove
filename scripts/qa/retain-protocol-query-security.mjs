import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {protocolQueryFolder, validateProtocolQuerySecurity} from './protocol-query-security-evidence.mjs';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2], output = resolve(root, protocolQueryFolder);
assert(input?.startsWith('/')); assert(!existsSync(output));
const original = resolve(input, 'sgm-protocol-query-input-20261105'), sources = JSON.parse(readFileSync(resolve(original, 'baseline-sources.json')));
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), hashes = {};
for (const [path, hash] of Object.entries(sources.hashes)) {
  const bytes = readFileSync(resolve(root, path)); assert.equal(sha(bytes), hash, 'Baseline probe/manifests changed: ' + path);
  const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'}); assert.equal(sha(readFileSync(archive)), hash);
}
const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', sources.head, '--', 'functions/src', 'admin/src', 'website/src', 'android', 'ios'],
  {cwd: root, encoding: 'utf8'}).trim().split('\n').filter(Boolean);
const application = paths.map(path => {
  const original = execFileSync('git', ['show', sources.head + ':' + path], {cwd: root}), hash = sha(original);
  assert.equal(sha(readFileSync(resolve(root, path))), hash, 'Application changed: ' + path); return {path, sha256: hash};
});
const inputs = {
  'lock-before.json': resolve(original, 'lock-before.json'), 'lock-after.json': resolve(root, 'package-lock.json'),
  'audit-before.json': resolve(original, 'audit-before.json'),
  'production-audit-before.json': resolve(original, 'production-audit-before.json'),
  'baseline-sources.json': resolve(original, 'baseline-sources.json'),
  'audit-after.json': resolve(input, 'sgm-protocol-query-audit-after-20261105.json'),
  'production-audit-after.json': resolve(input, 'sgm-protocol-query-production-audit-after-20261105.json'),
  'regressions-before.txt': resolve(input, 'sgm-protocol-query-baseline-20261105.log'),
  'regressions-after.txt': resolve(input, 'sgm-protocol-query-after-20261105.log'),
  'backend-units.txt': resolve(input, 'sgm-protocol-query-functions-20261105.log'),
  'build.txt': resolve(input, 'sgm-protocol-query-build-20261105.log'),
  'clean-install.txt': resolve(input, 'sgm-protocol-query-clean-install-20261105.log'),
  'interrupted-services.txt': resolve(input, 'sgm-protocol-query-services-20261105.log'),
  'initial-harness.txt': resolve(original, 'initial-harness.txt'),
  'rejected-package-plan.json': resolve(original, 'initial-package-plan.json'),
};
// Review every input before creating the retained bundle; never copy environment dumps.
const prepared = Object.entries(inputs).map(([name, path]) => {
  const bytes = readFileSync(path); assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  return [name, bytes];
});
mkdirSync(output);
function record(file, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + '\n');
  writeFileSync(resolve(output, file), bytes, {flag: 'wx'}); hashes[file] = sha(bytes);
}
for (const [name, bytes] of prepared) record(name, bytes);
record('application-sources.json', {baselineCommit: sources.head, files: application, allUnchanged: true});
record('summary.json', {checkedAt: '2026-11-06', baselineCommit: sources.head,
  scope: 'compatible-parser-patches-and-local-compatibility-not-release-clearance',
  directManifestsUnchanged: true, applicationSourcesUnchanged: true, existingRangesRespected: true,
  regressionsBefore: {passed: 6, failed: 6}, regressionsAfter: {passed: 12, failed: 0}, backendUnitCases: 623,
  allWorkspaceFindingsBefore: 30, allWorkspaceFindingsAfter: 28, remainingHighFindings: 5,
  productionFindingsBefore: 10, productionFindingsAfter: 8,
  interruptedServiceAttemptAccepted: false, interruptedServiceCauseConfirmed: false,
  initialHarnessCorrection: 'Use actual RPC service methods before the corrected baseline; the initial harness failure is not a vulnerability.',
  allSecurityFindingsResolved: false, productionExploitProven: false, productionDeployed: false, realPayments: false,
  physicalDeviceAccepted: false, nativeInstabilityRepaired: false, releaseComplete: false});
writeFileSync(resolve(output, 'artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n', {flag: 'wx'});
validateProtocolQuerySecurity(root, {includeCompatibility: false});
console.log('Retained exact compatible parser patches and corrected unchanged-source baseline; fresh service proof is separate.');
