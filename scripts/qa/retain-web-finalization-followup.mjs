import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..'), folder = resolve(root, 'docs/release/evidence/web-finalization-2026-11-03');
const [archive, buildFolder] = process.argv.slice(2); assert(archive && buildFolder && !existsSync(folder));
const gh = path => JSON.parse(execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/' + path], {encoding: 'utf8'}));
const source = '8bd9f503250ad022ae3d7b04b4248319f2c2a4d1', checks = gh('commits/' + source + '/check-runs?per_page=100');
assert(checks.check_runs.every(row => row.status === 'completed'));
const web = gh('actions/runs/41531744084'), jobs = gh('actions/runs/41531744084/attempts/2/jobs?per_page=100');
assert.equal(web.run_attempt, 2); assert.equal(web.conclusion, 'success');
assert(jobs.jobs.every(row => row.status === 'completed' && row.conclusion === 'success'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const unzip = (zip, name) => execFileSync('/usr/bin/unzip', ['-p', zip, name], {maxBuffer: 16 * 1024 * 1024});
const log = unzip(archive, '1_Functions, admin, and website checks.txt');
const boundary = log.toString().split('\n').filter(line => /Completed runner diagnostic log upload|Cleaning up orphan processes|##\[debug\]Finishing: (?:Complete job|Functions, admin, and website checks)$/.test(line));
assert.equal(boundary.length, 4);
const nativeJob = gh('actions/jobs/125598569095'); assert.equal(nativeJob.conclusion, 'failure');
const nativeLog = execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/jobs/125598569095/logs'], {maxBuffer: 8 * 1024 * 1024});
const failure = nativeLog.toString().split('\n').filter(line => line.includes('EvidenceCollectionError: Local evidence collection failed during trip-draft-restart; status=1, signal=null.'));
assert.equal(failure.length, 1);
const buildJob = JSON.parse(readFileSync(resolve(buildFolder, 'job.json'))), buildLog = readFileSync(resolve(buildFolder, 'original-job.log'));
assert.equal(buildJob.id, 125598569596); assert.equal(buildJob.head_sha, source); assert.equal(buildJob.conclusion, 'failure');
const dependency = buildLog.toString().split('\n').find(line => line.includes('Could not find org.jetbrains.kotlin:kotlin-stdlib:2.0.21.'));
assert(dependency);
mkdirSync(folder);
const write = (file, value) => writeFileSync(resolve(folder, file), Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
write('web-run-attempt2.json', web); write('web-jobs-attempt2.json', jobs); write('head-checks-8bd9f50.json', checks);
write('native-main-job.json', nativeJob); write('native-build-job.json', buildJob);
write('web-success-boundary.txt', Buffer.from(boundary.join('\n') + '\n'));
write('native-primary-copy-failure.txt', Buffer.from(failure[0] + '\n'));
write('native-dependency-failure.txt', Buffer.from(dependency + '\n'));
write('log-provenance.json', {downloadedArchiveSha256: sha(readFileSync(archive)), downloadedArchiveBytes: readFileSync(archive).length,
  upstreamArchiveDigestIndependentlyVerified: false, webLogMember: '1_Functions, admin, and website checks.txt',
  webLogSha256: sha(log), nativeMainLogSha256: sha(nativeLog), nativeBuildLogSha256: sha(buildLog), rawLogsPublished: false});
write('review.json', {scope: 'unchanged-source-web-diagnostic-pass-with-original-cancellation-and-native-failures-preserved',
  checkedAt: '2026-11-03', webSource: web.head_sha, currentChecksSource: source, webRun: web.id, webAttempt: 2,
  webJob: 125595925328, webAggregate: 125607796006, webRecheckPassed: true,
  originalCancellationAccepted: false, originalCancellationCauseProven: false, workflowOrDeadlinesChanged: false,
  nativeMainPassed: false, nativeChatPreparationPassed: false, fullNativeGatePassed: false,
  physicalDeviceAccepted: false, parentApprovalAccepted: false, productionWrites: false, releaseAccepted: false, publishedMedia: []});
write('artifact-sha256.json', Object.fromEntries(readdirSync(folder).map(file => [file, sha(readFileSync(resolve(folder, file)))])));
console.log('Retained web attempt two separately from the original cancellation and current native failures.');
