import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const source = 'c84b8e4a96f2f35d0b92f68b13904740b14d0dd3';
const folder = resolve(root, 'docs/release/evidence/checks-c84b8e4-2026-11-02');
const [mainZip, chatZip] = process.argv.slice(2);
assert(!existsSync(folder)); assert(mainZip && chatZip);
const gh = path => JSON.parse(execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/' + path], {encoding: 'utf8'}));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const artifacts = [gh('actions/artifacts/13182974329'), gh('actions/artifacts/13182213813')];
for (const [i, file] of [mainZip, chatZip].entries()) {
  const bytes = readFileSync(file); assert.equal(bytes.length, artifacts[i].size_in_bytes);
  assert.equal('sha256:' + sha(bytes), artifacts[i].digest);
  assert.equal(artifacts[i].workflow_run.head_sha, source);
}
const checks = gh('commits/' + source + '/check-runs?per_page=100');
assert(checks.check_runs.every(row => row.status === 'completed'));
mkdirSync(folder);
const write = (file, value) => {const path = resolve(folder, file); mkdirSync(resolve(path, '..'), {recursive: true});
  writeFileSync(path, Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});};
write('head-checks.json', checks);
for (const [file, path] of [['native-run.json', 'actions/runs/41531744223'], ['native-jobs.json', 'actions/runs/41531744223/jobs?per_page=100'],
  ['web-run.json', 'actions/runs/41531744084'], ['web-jobs.json', 'actions/runs/41531744084/jobs?per_page=100'],
  ['web-annotations.json', 'check-runs/125573409996/annotations']]) write(file, gh(path));
const members = {};
const take = (zip, id, member, file) => {
  const bytes = execFileSync('/usr/bin/unzip', ['-p', zip, member], {maxBuffer: 8 * 1024 * 1024});
  write(file, bytes); members[file] = {artifactId: id, member, sha256: sha(bytes)};
};
const names = zip => execFileSync('/usr/bin/unzip', ['-Z1', zip], {encoding: 'utf8'}).trim().split('\n');
const mainNames = names(mainZip), result = mainNames.find(name => /^outputs\/local-ui-evidence\/[a-f0-9]{32}\/results.json$/.test(name));
assert(result); const prefix = result.slice(0, -'results.json'.length);
for (const member of mainNames.filter(name => name.startsWith(prefix) && /\/(?:results\.json|[^/]+-instrumentation\.txt|adb-pull-[^/]+\.json)$/.test(name)))
  take(mainZip, artifacts[0].id, member, 'main/replay/' + member.slice(prefix.length));
for (const file of ['ordinary-instrumentation.txt', 'ordinary-results.json', 'native-suite-status.json', 'disposable-store-restore.json'])
  take(mainZip, artifacts[0].id, 'outputs/store-review-screenshots/' + file, 'main/' + file);
take(mainZip, artifacts[0].id, 'outputs/focused-safety-ui/full-matrix/host-shutdown/complete.json', 'main/host-exit.json');
const chatNames = names(chatZip), chatPrefix = 'focused-safety-ui/chat-network-recovery/';
for (const [member, file] of [['chat-network-recovery-suite-status.json', 'status.json'],
  ['disposable-device-restore.json', 'restoration.json'], ['host-shutdown/complete.json', 'host-exit.json']])
  take(chatZip, artifacts[1].id, chatPrefix + member, 'chat/' + file);
for (const file of ['local-chat-network-ui.json', 'LocalChatNetworkFlowTest-instrumentation.txt']) {
  const member = chatNames.find(name => name.endsWith('/' + file)); assert(member);
  take(chatZip, artifacts[1].id, member, 'chat/' + file);
}
write('artifacts.json', artifacts); write('archive-verification.json', {completeZipDigestsVerified: true, members});
const log = execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/jobs/125573409996/logs'], {maxBuffer: 20 * 1024 * 1024});
const finalLine = log.toString().trim().split('\n').at(-1);
assert(finalLine.endsWith('Cleaning up orphan processes'));
write('web-log-boundary.json', {jobId: 125573409996, originalLogSha256: sha(log), finalLine,
  logsProveFinalizationRootCause: false, sourceWorkloadFailed: false, wholeJobAccepted: false});
write('review.json', {scope: 'source-bound-main-pass-with-network-preparation-failure-and-web-finalization-incomplete', sourceCommit: source,
  nativeMainPassed: true, wholeNativeGatePassed: false, wholeWebGatePassed: false, chatNetworkFlowPassed: false,
  webFinalizationCauseProven: false, captureIntermittencyRepaired: false, parentApprovalProven: false,
  physicalTrackingAccepted: false, releaseAccepted: false, productionWrites: false, publishedMedia: []});
const files = readdirSync(folder, {recursive: true, withFileTypes: true}).filter(row => row.isFile());
write('artifact-sha256.json', Object.fromEntries(files.map(row => {
  const path = resolve(row.parentPath, row.name); return [path.slice(folder.length + 1), sha(readFileSync(path))];
})));
console.log('Retained original terminal checks and verified ZIP member provenance, without accepting either whole gate.');
