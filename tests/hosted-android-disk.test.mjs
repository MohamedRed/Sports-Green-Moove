import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {prepareHostedAndroidDisk, emulatorDiskReserveBytes as required, unusedHostedDotnet as pinned} from '../scripts/qa/prepare-hosted-android-disk.mjs';

const env = {CI: 'true', GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted', RUNNER_OS: 'Linux',
  GITHUB_JOB: 'android-native-ui', GITHUB_WORKSPACE: '/home/runner/work/sgm/sgm'};
function fixture(bytes = required - 1, after = required + 1) {
  let current = bytes, present = true; const removed = [];
  return {removed, options: {env, platform: 'linux', realpath: path => path,
    available: () => current, exists: path => {assert.equal(path, pinned); return present;},
    inspect: path => {assert.equal(path, pinned); return {isDirectory: () => true, isSymbolicLink: () => false};},
    remove: path => {assert.equal(path, pinned); removed.push(path); present = false; current = after;}}};
}
test('sufficient capacity does not remove anything', () => {
  const f = fixture(required); const report = prepareHostedAndroidDisk(f.options);
  assert.equal(report.ready, true); assert.equal(report.removedUnusedDotnet, false); assert.deepEqual(f.removed, []);
});
test('only one pinned unused hosted tool is removed and capacity is checked again', () => {
  const f = fixture(); const report = prepareHostedAndroidDisk(f.options);
  assert.deepEqual(f.removed, [pinned]); assert.equal(report.beforeBytes, required - 1);
  assert.equal(report.afterBytes, required + 1); assert.equal(report.ready, true);
  assert.equal(report.deviceStorageReduced, false); assert.equal(report.testScopeReduced, false);
});
test('low capacity and a missing optional tool remain unready, without another cleanup path', () => {
  const f = fixture(required - 2, required - 1); assert.equal(prepareHostedAndroidDisk(f.options).ready, false);
  const missing = fixture(); missing.options.exists = () => false;
  assert.equal(prepareHostedAndroidDisk(missing.options).ready, false); assert.deepEqual(missing.removed, []);
});
test('personal hosts, self-hosted runners, other jobs and invalid workspaces cannot remove files', () => {
  for (const patch of [{platform: 'darwin'}, {env: {...env, CI: 'false'}}, {env: {...env, GITHUB_ACTIONS: 'false'}},
    {env: {...env, RUNNER_ENVIRONMENT: 'self-hosted'}}, {env: {...env, RUNNER_OS: 'macOS'}},
    {env: {...env, GITHUB_JOB: 'android-focused-safety-ui'}}, {env: {...env, GITHUB_WORKSPACE: '/Users/mrr/project'}},
    {realpath: () => '/tmp/other'}]) {
    const f = fixture(); assert.throws(() => prepareHostedAndroidDisk({...f.options, ...patch})); assert.deepEqual(f.removed, []);
  }
});
test('symlinks, non-directories, failed removal and invalid filesystem readings fail closed', () => {
  for (const patch of [{inspect: () => ({isDirectory: () => true, isSymbolicLink: () => true})},
    {inspect: () => ({isDirectory: () => false, isSymbolicLink: () => false})},
    {realpath: path => path === pinned ? '/tmp/other' : path},
    {remove: () => {throw new Error('permission denied');}}, {remove: () => {}},
    {available: () => NaN}, {available: () => -1}]) {
    const f = fixture(); assert.throws(() => prepareHostedAndroidDisk({...f.options, ...patch}));
  }
});
test('the complete native job reclaims capacity after compilation and before unchanged emulator startup', () => {
  const workflow = readFileSync(new URL('../.github/workflows/native-ci.yml', import.meta.url), 'utf8');
  const job = workflow.slice(workflow.indexOf('\n  android-native-ui:'), workflow.indexOf('\n  android-focused-safety-ui:'));
  assert(job.indexOf('build-android-matrix-apks.mjs') < job.indexOf('prepare-hosted-android-disk.mjs'));
  assert(job.indexOf('prepare-hosted-android-disk.mjs') < job.indexOf('reactivecircus/android-emulator-runner@v2'));
  assert(job.includes('target: google_apis_playstore')); assert(job.includes('profile: pixel_6'));
  assert(job.includes('timeout-minutes: 50')); assert(!job.includes('disk-size:'));
  assert(job.includes('android/app/build/outputs/host-disk-capacity.json'));
});
