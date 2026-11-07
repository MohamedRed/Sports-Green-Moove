import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2]; assert(input?.startsWith('/'));
const dir = resolve(root, 'docs/release/evidence/ios-search-contract-portability-2026-11-05');
const read = path => readFileSync(resolve(root, path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const models = 'ios/Sources/SportsGreenMooveApp/TeamChatModels.swift', text = 'ios/Sources/SportsGreenMooveApp/TeamChatText.swift';
const old = JSON.parse(read('docs/release/evidence/ios-search-contract-2026-11-05/source-sha256.json')).files.find(row => row.path === models);
const original = read('docs/release/evidence/source-archive/' + old.sha256 + '.txt').toString();
const extracted = read(text).toString(), currentModels = read(models).toString();
assert.equal(extracted.slice(extracted.indexOf('enum TeamChatText')).trim(), original.slice(original.indexOf('enum TeamChatText')).trim());
assert.equal(currentModels.trim(), original.slice(0, original.indexOf('enum TeamChatText')).trim());
const runner = read('scripts/qa/check-ios-search-contract.mjs').toString();
assert(!/TeamChatModels\.swift|TeamChatWire\.swift|CryptoKit/.test(runner));
const log = readFileSync(resolve(input, 'sgm-search-contract-linux-failure-20261105.log'), 'utf8');
const error = log.split('\n').find(row => row.includes("error: no such module 'CryptoKit'")); assert(error);
mkdirSync(dir, {recursive: true}); assert(!existsSync(resolve(dir, 'summary.json')));
const records = [];
function record(name, bytes) {
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  writeFileSync(resolve(dir, name), bytes, {flag: 'wx'}); records.push({file: name, sha256: sha(bytes)});
}
record('linux-failure.json', json({runId: 42080158221, jobId: 127430792792,
  sourceCommit: '9ae6ea709da5f487a51a1542864d4cf4d0e8f4b1',
  step: 'Verify iPhone search-to-booking contract without provider calls', conclusion: 'failure',
  compilationStoppedBeforeContractCases: true, selectedError: error.split('\t').at(-1)}));
for (const [name, path, marker] of [
  ['contract-result.txt', 'sgm-search-contract-normalization-extraction-20261105.log', '60 incomplete, contradictory or unsafe response groups'],
  ['native-result.txt', 'sgm-normalization-portability-native-final-20261105.log', 'OwnedPlacesAdapterChecks passed'],
  ['signature-result.txt', 'sgm-normalization-portability-signature-final-20261105.log', 'not an SDK build or phone test'],
]) {
  const bytes = readFileSync(resolve(input, path)); assert(bytes.toString().includes(marker));
  assert(!/error:|Fatal error/.test(bytes.toString())); record(name, bytes);
}
const paths = [models, text, 'scripts/qa/check-ios-search-contract.mjs', 'scripts/check-ios-native-plan.sh',
  'scripts/check-ios-support-concurrency.sh', 'scripts/qa/check-ios-owned-places.sh', 'scripts/qa/check-ios-ride-chat-runtime.sh'];
const files = paths.map(path => {
  const bytes = read(path), hash = sha(bytes), archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(archive)), hash); return {path, sha256: hash};
});
record('source-sha256.json', json({files}));
record('summary.json', json({checkedAt: '2026-11-05', scope: 'remove-unrelated-crypto-build-dependency-from-controlled-search-contract',
  failedLinuxCompilationRetained: true, normalizationImplementationUnchanged: true, chatCryptoImplementationUnchanged: true,
  localContractPassed: true, localNativeChecksPassed: true, localSignatureChecksPassed: true,
  linuxExecutionAccepted: false, nativeSdkAccepted: false, nativeUiAccepted: false, physicalDeviceAccepted: false,
  providerRequests: 0, productionWrites: 0, newMedia: 0, releaseComplete: false, records: [...records]}));
console.log('Retained the failed Linux compiler boundary and unchanged extracted normalization with passing local rechecks; Linux/native acceptance remains pending.');
