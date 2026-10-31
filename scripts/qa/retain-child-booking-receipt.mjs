import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve, isAbsolute} from 'node:path';
import {childBookingReceiptFolder, validateChildBookingReceiptEvidence, validateLatestPreparationDiagnostics} from './child-booking-receipt-evidence.mjs';

const [input] = process.argv.slice(2); assert(isAbsolute(input ?? ''));
const root = resolve(import.meta.dirname, '../..'), base = resolve(root, childBookingReceiptFolder);
assert(!existsSync(base), 'Never overwrite retained originals');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => {
  mkdirSync(resolve(base, file, '..'), {recursive: true});
  writeFileSync(resolve(base, file), typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
};
const copy = (from, to) => save(to, readFileSync(resolve(input, from)));
copy('child-booking-receipt-services-v5.json', 'services.json');
copy('child-booking-receipt-services-v5.json.cleanup.json', 'cleanup.json');
copy('child-booking-receipt-services-v2.json', 'earlier-observer-failure.json');
const chat = 'ef8b998-chat-network/local-ui-evidence/a9a2a99035dae4ba53bb61ccd79df058/';
for (const file of ['local-chat-network-ui.json', 'chat-network-validation-after.json']) copy(chat + file, 'ci/chat/' + file);
copy(chat + 'LocalChatNetworkFlowTest-instrumentation.txt', 'ci/chat/instrumentation.txt');
copy('ef8b998-chat-network/focused-safety-ui/chat-network-recovery/disposable-device-restore.json', 'ci/chat/device-restore.json');
for (const file of readdirSync(resolve(input, 'ef8b998-transfer'))) {
  assert(/^(trial-\d{2}|result|started|environment)\.json$/.test(file)); copy('ef8b998-transfer/' + file, 'ci/transfer/' + file);
}
const gh = args => execFileSync('gh', args, {encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
save('ci/chat-job.json', gh(['api', 'repos/MohamedRed/Sports-Green-Moove/actions/jobs/124185986199']));
save('ci/transport-run.json', gh(['run', 'view', '41091421917', '--repo', 'MohamedRed/Sports-Green-Moove', '--json', 'databaseId,headSha,status,conclusion,jobs,url']));
save('ci/native-run.json', gh(['run', 'view', '41091421741', '--repo', 'MohamedRed/Sports-Green-Moove', '--json', 'databaseId,headSha,status,conclusion,jobs,url']));
for (const [name, id] of [['chat', 12993913952], ['transport', 12994561945], ['main', 12995267188]])
  save('ci/' + name + '-artifact.json', gh(['api', 'repos/MohamedRed/Sports-Green-Moove/actions/artifacts/' + id]));
const main = 'ef8b998-main/outputs/local-ui-evidence/90aae7ec5711aef48c29604d10b5654c/';
for (const file of ['results.json', 'local-chat-network-ui.json', ...readdirSync(resolve(input, main)).filter(file => /^adb-pull-.*\.json$/.test(file))])
  copy(main + file, 'ci/main/' + file);
for (const file of ['ordinary-instrumentation.txt', 'ordinary-results.json', 'native-suite-status.json', 'disposable-store-restore.json'])
  copy('ef8b998-main/outputs/store-review-screenshots/' + file, 'ci/main/' + file);
const report = JSON.parse(readFileSync(resolve(base, 'services.json'))), sources = {...report.sourceFiles};
const retain = (file, bytes, expected = sha(bytes)) => {
  assert.equal(sha(bytes), expected); const path = resolve(root, 'docs/release/evidence/source-archive', expected + '.txt');
  if (existsSync(path)) assert.deepEqual(readFileSync(path), bytes); else writeFileSync(path, bytes, {flag: 'wx'});
  return expected;
};
for (const [file, hash] of Object.entries(sources)) retain(file, readFileSync(resolve(root, file)), hash);
for (const file of ['scripts/diagnostics/adb-transfer-probe.mjs', 'scripts/diagnostics/run-adb-transfer-probe.mjs',
  'scripts/qa/local-network-validation-diagnostics.mjs', 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalChatNetworkFlowTest.kt']) {
  const bytes = execFileSync('git', ['show', 'ef8b99810e45cf126f31e416e22404bcb9f1b7c3:' + file]); sources[file] = retain(file, bytes);
}
save('source-sha256.json', sources);
save('scope.json', {scope: 'local-child-booking-service-recheck-and-separate-failed-ci-diagnostics-not-physical-or-release-proof',
  appSourceCommit: 'ef8b99810e45cf126f31e416e22404bcb9f1b7c3', qaSourceBinding: 'exact-working-tree-bytes-hashed-before-and-after-run',
  physicalUiVerified: false, newPublicMedia: [], productionWrites: false, releaseComplete: false});
const hashes = {};
for (const entry of readdirSync(base, {recursive: true, withFileTypes: true}).filter(row => row.isFile())) {
  const path = resolve(entry.parentPath, entry.name); hashes[path.slice(base.length + 1)] = sha(readFileSync(path));
}
save('artifact-sha256.json', hashes);
console.log(JSON.stringify({childBooking: validateChildBookingReceiptEvidence(root), diagnostics: validateLatestPreparationDiagnostics(root)}));
