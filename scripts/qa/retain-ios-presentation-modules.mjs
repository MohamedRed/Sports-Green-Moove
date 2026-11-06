import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';

const [beforePath, afterPath, nativePath] = process.argv.slice(2);
for (const path of [beforePath, afterPath, nativePath]) assert(isAbsolute(path ?? ''));
const root = resolve(import.meta.dirname, '../..'), relative = 'docs/release/evidence/ios-presentation-modules-2026-11-06';
const base = resolve(root, relative); assert(!existsSync(base));
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), records = [], files = [];
const before = readFileSync(beforePath), after = readFileSync(afterPath), native = readFileSync(nativePath);
assert(before.includes("cannot find type 'AccountAccess' in scope"));
assert(after.includes('Owned callable signature checks passed; this is not an SDK build or phone test.'));
assert(native.includes('ChildAccountPresentationChecks passed:')); assert(native.includes('SportsGreenMooveNativeChecks passed'));
assert(native.includes('OwnedPlacesAdapterChecks passed:'));
const prior = 'b0aa2821cf4e7f8959d994b39a0ecab494324ef5', app = 'ios/Sources/SportsGreenMooveApp/';
const old = execFileSync('git', ['show', prior + ':' + app + 'ChildAccountModels.swift'], {cwd: root}).toString();
const block = readFileSync(resolve(root, app + 'ChildAccountPresentation.swift'), 'utf8').replace('import Foundation\n\n', '');
assert(old.includes(block)); assert.equal(readFileSync(resolve(root, app + 'ChildAccountModels.swift'), 'utf8'), old.replace(block + '\n', ''));
const strict = 'scripts/check-ios-support-concurrency.sh';
assert.deepEqual(readFileSync(resolve(root, strict)), execFileSync('git', ['show', prior + ':' + strict], {cwd: root}));
mkdirSync(base, {recursive: true});
function save(file, bytes) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(JSON.stringify(bytes, null, 2) + '\n');
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  writeFileSync(resolve(base, file), bytes, {flag: 'wx'}); records.push({file, sha256: sha(bytes)});
}
save('signatures-before.txt', before); save('signatures-after.txt', after); save('native-checks.txt', native);
for (const path of [app + 'ChildAccountModels.swift', app + 'ChildAccountPresentation.swift', 'scripts/check-ios-native-plan.sh', strict]) {
  const bytes = readFileSync(resolve(root, path)), hash = sha(bytes), archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (existsSync(archive)) assert.equal(sha(readFileSync(archive)), hash); else writeFileSync(archive, bytes, {flag: 'wx'});
  files.push({path, sha256: hash});
}
save('source-sha256.json', {files});
save('summary.json', {checkedAt: '2026-11-06', priorSourceCommit: prior, signatureFailureReproduced: true,
  originalSignatureHarnessPreserved: true, signatureChecksPassed: true, nativePlanPassed: true,
  presentationGuardBytesPreserved: true, sharedDtoAccountDependencyRemoved: true,
  sdkUiAccepted: false, physicalDeviceAccepted: false, releaseComplete: false, records: [...records]});
console.log(JSON.stringify({source: relative + '/summary.json', sha256: sha(readFileSync(resolve(base, 'summary.json')))}));
