import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';
import {reviewRecoveryFolder, recoveryCaptureIds, validateReviewRecovery} from './review-recovery-evidence.mjs';

const [trial] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert(isAbsolute(trial ?? '')); const base = resolve(root, reviewRecoveryFolder);
assert(!existsSync(base)); await assertLocalEndpointsClosed([5001, 8080, 9000, 9099, 5580, 5037]);
mkdirSync(base, {recursive: true});
const files = [], hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => {writeFileSync(resolve(base, file), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'}); files.push(file);};
const copy = (from, to) => {mkdirSync(dirname(resolve(base, to)), {recursive: true}); copyFileSync(from, resolve(base, to)); files.push(to);};
for (const [from, to] of [['review-recovery-services-final.json', 'service.json'], ['recovery-device-copy-final.json', 'device-copy.json'],
  ['recovery-disposal-final.json', 'disposal.json'], ['review-network-before.txt', 'before.txt'], ['review-network-after.txt', 'intermediate.txt'],
  ['recovery-test-inbox-count-before.kt.txt', 'intermediate-test.kt.txt'], ['review-network-busy-verified.txt', 'components.txt'],
  ['review-recovery-functions-tests.log', 'backend-units.txt'], ['recovery-build-busy-correct.log', 'android-build.txt'],
  ['review-recovery-context-regression.json', 'context-regression.json'], ['review-recovery-received-regression.json', 'received-regression.json']]) copy(resolve(trial, from), to);
for (const id of recoveryCaptureIds) {
  const name = 'review-submission-network-' + id + '.png'; copy(resolve(trial, 'recovery-captures-final', name), 'captures/' + name);
}
const archive = resolve(root, 'docs/release/evidence/source-archive');
const retain = (file, expected) => {
  const bytes = readFileSync(resolve(root, file)), digest = hash(bytes); if (expected) assert.equal(digest, expected, file);
  const path = resolve(archive, digest + '.txt'); if (!existsSync(path)) writeFileSync(path, bytes, {flag: 'wx'});
  return digest;
};
for (const name of ['service', 'context-regression', 'received-regression'])
  for (const [file, digest] of Object.entries(JSON.parse(readFileSync(resolve(base, name + '.json'))).sourceFiles)) retain(file, digest);
const prefix = 'android/app/src/', ui = 'java/be/sportgreenmoove/app/ui/';
const sourceFiles = ['MessagesInboxState.kt', 'MessagesInboxRoute.kt', 'ReviewCard.kt'].map(file => prefix + 'main/' + ui + file)
  .concat(['ReviewSubmissionRecoveryFlowTest.kt', 'ReviewTripContextFlowTest.kt', 'PendingReviewPaginationFlowTest.kt',
    'ReceivedRatingsFlowTest.kt', 'LocalUiCapture.kt'].map(file => prefix + 'androidTest/' + ui + file))
  .concat(prefix + 'test/' + ui + 'ReviewSubmissionStateTest.kt');
save('native-sources.json', Object.fromEntries(sourceFiles.map(file => [file, retain(file)])));
for (const file of ['MessagesInboxState.kt', 'MessagesInboxRoute.kt', 'ReviewCard.kt']) {
  const bytes = execFileSync('git', ['show', 'da317d9222852b2aac27c577465339b911d3a5c4:' + prefix + 'main/' + ui + file], {cwd: root});
  writeFileSync(resolve(base, 'before-' + file + '.txt'), bytes, {flag: 'wx'}); files.push('before-' + file + '.txt');
}
const units = {tests: 0, failures: 0, errors: 0, skipped: 0}, parser = new XMLParser({ignoreAttributes: false});
const directory = resolve(root, 'android/app/build/test-results/testDebugUnitTest');
for (const file of readdirSync(directory).filter(file => file.endsWith('.xml'))) {
  const suite = parser.parse(readFileSync(resolve(directory, file), 'utf8')).testsuite;
  for (const key of Object.keys(units)) units[key] += Number(suite['@_' + key] ?? 0);
  copy(resolve(directory, file), 'junit/' + file);
}
save('android-unit-counts.json', units);
save('summary.json', {scope: 'isolated-review-submission-recovery-components-and-callables-not-phone', testedAt: new Date().toISOString(),
  nativeComponentCases: 11, newNativeCases: 2, backendUnitCases: 547, implementationUncommittedAtBuild: true,
  physicalNetworkLossProven: false, physicalDeviceTested: false, iosUiExecuted: false, productionDeployed: false,
  productionWrites: false, fullNativeGatePassed: false, releaseComplete: false});
save('artifact-sha256.json', Object.fromEntries(files.map(file => [file, hash(readFileSync(resolve(base, file)))])));
console.log(JSON.stringify(validateReviewRecovery(root)));
