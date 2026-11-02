import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..'), folder = resolve(root, 'docs/release/evidence/uri-security-2026-11-02');
const json = file => JSON.parse(readFileSync(resolve(folder, file))), sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert(!existsSync(resolve(folder, 'summary.json')));
assert.equal(json('compatibility-followup/complete.json').completed, true);
const gh = args => JSON.parse(execFileSync('/opt/homebrew/bin/gh', args, {encoding: 'utf8'}));
const checks = gh(['pr', 'view', '1', '--repo', 'MohamedRed/Sports-Green-Moove', '--json', 'headRefOid,statusCheckRollup']);
assert.equal(checks.headRefOid, 'fbfc7e041aa3c8d086fc7ae5fadbf4c574c365d7');
assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED'));
const write = (name, value) => writeFileSync(resolve(folder, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const correctedSources = json('after-corrected/source-sha256.json');
assert.deepEqual(correctedSources, json('before-corrected/source-sha256.json'));
const originalSources = json('before/source-sha256.json'); assert.deepEqual(originalSources, json('after/source-sha256.json'));
const helper = 'tests/helpers/uri-security-probe.mjs', revised = readFileSync(resolve(root, helper), 'utf8');
const added = `    const refusesInjectedEquality = () => {
      try {return uri.equal({...component}, 'http://trusted.invalid:@untrusted.invalid:8124/trip') === false;}
      catch (error) {return error instanceof TypeError && error.message === 'URI port is malformed.';}
    };
    const refusesEncodedResolution = () => {
      try {return inert(uri.resolve('https://trusted.invalid/', '%6Aavascript:alert(1)'));}
      catch (error) {return error.constructor === Error && error.message === 'URI scheme is malformed.';}
    };
`;
assert.equal(revised.split(added).length, 2);
const original = revised.replace(added, '')
  .replace("['equal-rejects-port-authority-injection', refusesInjectedEquality]",
    "['equal-rejects-port-authority-injection', () => rejectsPort(() => uri.equal({...component}, 'http://trusted.invalid/trip'))]")
  .replace("['resolve-keeps-percent-encoded-scheme-inert', refusesEncodedResolution]",
    "['resolve-keeps-percent-encoded-scheme-inert', () => inert(uri.resolve('https://trusted.invalid/', '%6Aavascript:alert(1)'))]");
assert.equal(sha(original), originalSources[helper], 'Recovered original source must match the digest recorded before correction');
for (const files of [correctedSources, originalSources]) for (const [path, hash] of Object.entries(files)) {
  const bytes = files === originalSources && path === helper ? Buffer.from(original) : readFileSync(resolve(root, path));
  assert.equal(sha(bytes), hash, path);
  const target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (existsSync(target)) assert(readFileSync(target).equals(bytes)); else writeFileSync(target, bytes, {flag: 'wx'});
}
const before = json('before-corrected/lock-snapshot.json'), after = json('after-corrected/lock-snapshot.json');
assert.equal(before.otherPackagesSha256, after.otherPackagesSha256); assert.equal(before.declarationsSha256, after.declarationsSha256);
const meta = await (await fetch('https://registry.npmjs.org/fast-uri/3.1.9')).json();
assert.equal(meta.version, '3.1.9'); assert.equal(meta.dist.integrity, after.fastUri.integrity);
write('maintainer.json', {version: meta.version, tarball: meta.dist.tarball, integrity: meta.dist.integrity,
  source: 'https://github.com/fastify/fast-uri/releases/tag/v3.1.9',
  advisories: ['https://github.com/fastify/fast-uri/security/advisories/GHSA-qw65-cvwx-89v3',
    'https://github.com/fastify/fast-uri/security/advisories/GHSA-w74x-v6f9-j3xg']});
write('baseline-pr-checks.json', checks);
const baselineLog = execFileSync('/opt/homebrew/bin/gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/jobs/125553230069/logs'], {encoding: 'utf8'});
const lines = baselineLog.split('\n'), index = lines.findIndex(line => line.includes('EvidenceCollectionError:'));
assert(index >= 0); writeFileSync(resolve(folder, 'baseline-native-excerpt.txt'), lines.slice(index, index + 8).join('\n') + '\n', {flag: 'wx'});
write('summary.json', {scope: 'compatible-real-uri-consumer-security-and-local-flow-regressions-not-production-exploit-or-release',
  checkedAt: '2026-11-02', baselineCommit: checks.headRefOid, beforeVersion: '3.1.2', afterVersion: '3.1.9',
  changedLockEntries: 1, correctedUriCases: 12, correctedFailuresBefore: 8, correctedFailuresAfter: 0,
  ordinaryControls: 4, existingSecurityCasesPreserved: 18, completeSecurityCasesAfter: 30,
  initialPatchedProbeAssertionFailuresRetained: 2, initialCompatibilityLaunchFailureRetained: true,
  backendUnitCases: 623, rulesCases: 208, paymentCases: 78, childApprovalCases: 10, childInvitationCases: 18,
  auditBefore: {total: 38, high: 10, moderate: 28}, auditAfter: {total: 37, high: 9, moderate: 28},
  sameCorrectedRegressionSources: true, cleanInstallExecuted: true, compatibleConsumerRange: true,
  otherLockEntriesUnchanged: true, declarationsUnchanged: true, baselineNativeJobPassed: false,
  productionExploitProven: false, productionRuntimeChanged: false, productionDeployed: false,
  parentApprovalPhoneAccepted: false, physicalDeviceAccepted: false, realPayments: false,
  allSecurityFindingsResolved: false, nativeInstabilityRepaired: false, postPatchNativeGateAccepted: false,
  releaseAccepted: false, publicCapturesAdded: 0});
const files = readdirSync(folder, {recursive: true, withFileTypes: true}).filter(row => row.isFile() && row.name !== 'README.md');
write('artifact-sha256.json', Object.fromEntries(files.map(row => {
  const path = resolve(row.parentPath, row.name); return [path.slice(folder.length + 1), sha(readFileSync(path))];
})));
console.log('Retained the original failed assumptions and launch, corrected comparisons and local compatibility.');
