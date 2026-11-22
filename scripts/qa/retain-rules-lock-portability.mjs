import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const root = resolve(import.meta.dirname, '../..'), input = process.argv[2]; assert(input?.startsWith('/'));
const folder = resolve(root, 'docs/release/evidence/rules-lock-portability-2026-11-05');
mkdirSync(folder, {recursive: true}); assert(!existsSync(resolve(folder, 'summary.json')));
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const records = [];
function record(file, value) {
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}/.test(value.toString()));
  writeFileSync(resolve(folder, file), value, {flag: 'wx'}); records.push({file, sha256: sha(value)});
}
const log = readFileSync(resolve(input, 'sgm-a37-web-failed-20261105.log'), 'utf8');
const lines = log.split('\n').filter(line => /Installing hashicorp\/google v7\.46\.2|Installed hashicorp\/google v7\.46\.2|Provider lock file not updated|cached package for registry.terraform.io\/hashicorp\/google 7.46.2/.test(line));
assert.equal(lines.length, 4); record('linux-ci-failure.txt', lines.join('\n') + '\n');
const original = execFileSync('git', ['show', 'a37cdbf:infra/firestore-rules/.terraform.lock.hcl'], {cwd: root});
const candidate = readFileSync(resolve(root, 'infra/firestore-rules/.terraform.lock.hcl'));
record('before.lock.hcl', original); record('candidate.lock.hcl', candidate);
const hashes = text => [...text.toString().matchAll(/"((?:h1|zh):[^"\n]+)"/g)].map(match => match[1]);
const before = hashes(original), after = hashes(candidate), added = after.filter(hash => !before.includes(hash));
assert.deepEqual(added, ['h1:wSW/wc+C48Eiuv8UXQhczRs6QXX6622m+QMlpi0pHVw=']);
assert(before.every(hash => after.includes(hash))); assert.equal(after.length, before.length + 1);
const locking = readFileSync(resolve(input, 'sgm-rules-linux-provider-lock-20261105.log'));
assert(locking.toString().includes('Retrieved hashicorp/google 7.46.2 for linux_amd64 (signed by HashiCorp)'));
record('signed-platform-lock.txt', locking);
record('readonly-init.txt', readFileSync(resolve(input, 'sgm-rules-lock-readonly-init-20261105.log')));
const validated = JSON.parse(readFileSync(resolve(input, 'sgm-rules-lock-validate-20261105.json'))); assert.equal(validated.valid, true);
record('local-validation.json', json(validated));
record('summary.json', json({checkedAt: '2026-11-05', scope: 'provider-lock-portability-not-cloud-deployment',
  originalRunId: 42064566618, originalJobId: 127375010440, originalCommit: 'a37cdbf263642d2a9a26a0af3cf2b0363886bb97',
  originalConclusion: 'failure', failedStep: 'Validate rules configuration without cloud changes',
  provider: 'registry.terraform.io/hashicorp/google', version: '7.46.2', beforeHashes: before, afterHashes: after,
  addedLinuxHash: added[0], priorWorkstationHashPreserved: true, officialSignedPackageRetrieved: true,
  localPlatform: 'darwin_arm64', terraformVersion: '1.14.0', readonlyInitExitCode: 0, validateExitCode: 0, fmtExitCode: 0,
  linuxCiValidationAccepted: false, cloudPlans: 0, cloudApplies: 0, providerUpgrade: false,
  checksumVerificationWeakened: false, applicationSourceChanged: false, newMedia: 0, releaseComplete: false,
  records: [...records]}));
console.log('Retained the real Linux checksum failure and signed platform-lock correction without cloud operations.');
