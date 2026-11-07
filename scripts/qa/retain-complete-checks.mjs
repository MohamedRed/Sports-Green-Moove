import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {completeChecksFolder, completeChecksSource} from './complete-checks-evidence.mjs';

const root = resolve(import.meta.dirname, '../..'), folder = resolve(root, completeChecksFolder);
assert(!existsSync(folder)); mkdirSync(folder);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (file, data) => {const path = resolve(folder, file); mkdirSync(resolve(path, '..'), {recursive: true});
  writeFileSync(path, Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});};
const gh = path => JSON.parse(execFileSync('/opt/homebrew/bin/gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/' + path], {encoding: 'utf8'}));
for (const [file, path] of [['native-run.json', 'actions/runs/41438000520'], ['native-jobs.json', 'actions/runs/41438000520/jobs?per_page=100'],
  ['web-run.json', 'actions/runs/41438000498'], ['web-jobs.json', 'actions/runs/41438000498/jobs?per_page=100'],
  ['head-checks.json', 'commits/' + completeChecksSource + '/check-runs?per_page=100'],
  ['native-artifact.json', 'actions/artifacts/13141272714'], ['previous/native-job.json', 'actions/jobs/125159015041']]) write(file, gh(path));
const zip = '/Users/mrr/.codex/tmp/sgm-638066c-native-complete-20261102.zip';
const artifact = JSON.parse(readFileSync(resolve(folder, 'native-artifact.json'))), archive = readFileSync(zip);
assert.equal(archive.length, artifact.size_in_bytes); assert.equal('sha256:' + sha(archive), artifact.digest);
const names = execFileSync('/usr/bin/unzip', ['-Z1', zip], {encoding: 'utf8'}).trim().split('\n');
const members = {}, take = (member, destination) => {
  const bytes = execFileSync('/usr/bin/unzip', ['-p', zip, member], {maxBuffer: 8 * 1024 * 1024});
  write(destination, bytes); members[destination] = {member, sha256: sha(bytes)};
};
for (const file of ['ordinary-instrumentation.txt', 'ordinary-results.json', 'ordinary-process.json',
  'native-suite-status.json', 'disposable-device-setup.json', 'disposable-store-restore.json']) take('outputs/store-review-screenshots/' + file, 'main/' + file);
const result = names.find(path => /^outputs\/local-ui-evidence\/[a-f0-9]{32}\/results.json$/.test(path)); assert(result);
const prefix = result.slice(0, -'results.json'.length);
for (const member of names.filter(path => path.startsWith(prefix) && /\/(?:results\.json|[^/]+-instrumentation\.txt|adb-pull-[^/]+\.json)$/.test(path)))
  take(member, 'main/replay/' + member.slice(prefix.length));
const capture = names.filter(path => /primary-capture-diagnostics\/trip-change-parent-accepted-\d+\.json$/.test(path));
assert.equal(capture.length, 1); take(capture[0], 'main/parent-accepted-capture.json');
write('archive-verification.json', {sha256: sha(archive), bytes: archive.length, originalArchivePublished: false, members});
const previous = '/Users/mrr/.codex/tmp/sgm-d55a112-native-artifact-20261102.zip';
const previousArtifact = gh('actions/artifacts/13125998473'), previousBytes = readFileSync(previous), previousMembers = {};
assert.equal(previousBytes.length, previousArtifact.size_in_bytes); assert.equal('sha256:' + sha(previousBytes), previousArtifact.digest);
write('previous/native-artifact.json', previousArtifact);
for (const [member, destination] of [
  ['outputs/store-review-screenshots/ordinary-instrumentation.txt', 'previous/ordinary-instrumentation.txt'],
  ['outputs/store-review-screenshots/capture-timing/primary-capture-diagnostics/trip-change-parent-accepted-609220273044.json', 'previous/parent-accepted-capture.json'],
]) {
  const bytes = execFileSync('/usr/bin/unzip', ['-p', previous, member], {maxBuffer: 8 * 1024 * 1024});
  write(destination, bytes); previousMembers[destination] = {member, sha256: sha(bytes)};
}
write('previous/archive-verification.json', {sha256: sha(previousBytes), bytes: previousBytes.length, members: previousMembers});
const sources = {};
for (const file of ['scripts/run-android-ui-tests-and-collect-screenshots.sh', 'scripts/qa/run-ordinary-android-ui.mjs',
  'scripts/qa/collect-local-ui-evidence.mjs', 'scripts/qa/run-local-android-flows.mjs',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TripChangeFlowTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/PrimaryCaptureProbe.kt', '.github/workflows/web-integration-smoke.yml']) {
  const bytes = execFileSync('git', ['show', completeChecksSource + ':' + file], {cwd: root}); sources[file] = sha(bytes);
  const target = resolve(root, 'docs/release/evidence/source-archive', sources[file] + '.txt');
  if (existsSync(target)) assert(readFileSync(target).equals(bytes)); else writeFileSync(target, bytes, {flag: 'wx'});
}
write('source-files.json', sources);
write('review.json', {scope: 'source-specific-complete-automated-checks-not-intermittency-repair-or-physical-release',
  sourceCommit: completeChecksSource, nativeRun: 41438000520, nativeJob: 125252512809, nativeArtifact: 13141272714,
  webRun: 41438000498, ordinaryPassed: 248, ordinarySkipped: 55, ordinaryFailed: 0, replayGroups: 37,
  replayNativeCases: 40, primaryCopies: 17, focusedJobs: 11, hostedPassed: 24, hostedSkipped: 5,
  sourceSpecificFullGatePassed: true, currentHeadGateAccepted: false, physicalDeviceAccepted: false,
  productionWrites: false, releaseAccepted: false, earlierFailureRepaired: false, underlyingCauseConfirmed: false,
  signupPhoneAccepted: false, publishedMedia: []});
const hashes = Object.fromEntries(readdirSync(folder, {recursive: true, withFileTypes: true}).filter(row => row.isFile())
  .map(row => {const path = resolve(row.parentPath, row.name); return [path.slice(folder.length + 1), sha(readFileSync(path))];}));
write('artifact-sha256.json', hashes);
console.log('Retained source-specific complete checks, original transcripts, primary copies and the earlier failed capture.');
