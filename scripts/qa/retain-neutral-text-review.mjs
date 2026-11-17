import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {neutralTextCases, validateNeutralTextCaptureFiles} from './neutral-text-contrast-evidence.mjs';

const input = process.argv[2];
assert.equal(process.argv.length, 3); assert(isAbsolute(input ?? ''));
const root = resolve(import.meta.dirname, '../..');
const output = resolve(root, 'docs/release/evidence/neutral-text-visual-2026-10-30');
assert(!existsSync(output), 'Never overwrite a retained review');
const commit = 'dcd7a5e68ce860488db046bc86ea5dc0cda05593';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const zip = resolve(input, 'original-artifact.zip'), zipBytes = readFileSync(zip);
const expectedDigest = '8e806c753971906cb751675cd55d3a0f2f333a9a417c72fe5c838937b4b8b914';
assert.equal(sha(zipBytes), expectedDigest);
const gh = path => JSON.parse(execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/' + path],
  {encoding: 'utf8', timeout: 30_000}));
const artifact = gh('actions/artifacts/13004387937'), job = gh('actions/jobs/124253008613');
assert.equal(artifact.digest, 'sha256:' + expectedDigest); assert.equal(artifact.size_in_bytes, zipBytes.length);
assert.equal(artifact.workflow_run.head_sha, commit); assert.equal(job.conclusion, 'success');
const captures = resolve(input, 'selected/outputs/store-review-screenshots/sgm-neutral-text');
validateNeutralTextCaptureFiles(captures);
mkdirSync(output); mkdirSync(resolve(output, 'captures'));
const files = [], members = {};
const save = (name, bytes) => {writeFileSync(resolve(output, name), bytes, {flag: 'wx'}); files.push(name);};
const json = (name, value) => save(name, JSON.stringify(value, null, 2) + '\n');
for (const name of neutralTextCases) for (const suffix of ['.png', '-window.png', '.json']) {
  const file = name + suffix, member = 'outputs/store-review-screenshots/sgm-neutral-text/' + file;
  const bytes = readFileSync(resolve(captures, file));
  assert.deepEqual(execFileSync('unzip', ['-p', zip, member], {maxBuffer: 4 * 1024 * 1024}), bytes);
  save('captures/' + file, bytes); members[member] = sha(bytes);
}
const xmlMember = 'outputs/androidTest-results/connected/debug/TEST-guarded-components.xml';
const xml = execFileSync('unzip', ['-p', zip, xmlMember], {maxBuffer: 4 * 1024 * 1024});
save('TEST-guarded-components.xml', xml); members[xmlMember] = sha(xml);
const sourcePaths = [
  ...['SgmColors.kt', 'SgmTheme.kt', 'DesignTokens.kt'].map(name => 'android/app/src/main/java/be/sportgreenmoove/app/design/' + name),
  ...['SearchScreen.kt', 'SearchPlaceFields.kt', 'SearchChildSelector.kt', 'SearchMatchCard.kt', 'SearchFormState.kt',
    'TripsScreen.kt', 'V2Components.kt'].map(name => 'android/app/src/main/java/be/sportgreenmoove/app/ui/' + name),
  ...['NeutralTextLayoutTest.kt', 'NeutralTextCapture.kt', 'UiFlowFixtures.kt']
    .map(name => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + name),
];
const sourceFiles = {}, archive = resolve(root, 'docs/release/evidence/source-archive');
for (const file of sourcePaths) {
  const bytes = execFileSync('git', ['show', commit + ':' + file], {cwd: root, maxBuffer: 2 * 1024 * 1024});
  assert.deepEqual(bytes, readFileSync(resolve(root, file)), 'Reviewed components changed: ' + file);
  const hash = sha(bytes), path = resolve(archive, hash + '.txt'); sourceFiles[file] = hash;
  if (existsSync(path)) assert.deepEqual(readFileSync(path), bytes); else writeFileSync(path, bytes, {flag: 'wx'});
}
json('job.json', job); json('artifact.json', artifact);
json('selection.json', {originalArchiveSha256: expectedDigest, originalArchiveBytes: zipBytes.length,
  originalArchiveRetainedPrivately: true, selectedMembersComparedByteForByte: true, members});
json('review.json', {scope: 'reviewed-neutral-text-components-not-full-app-accessibility', sourceCommit: commit,
  sourceRun: 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41110977694', reviewedAt: '2026-10-30',
  cases: neutralTextCases, fontScale: 1.3, reviewedViewports: 8, neutralTextOverlapObserved: false,
  sourceFiles, physicalDevice: false, connectedFlow: false, screenReaderVerified: false,
  accentContrastAccepted: false, systemInsetsAccepted: false, releaseAccepted: false, mediaEdits: false});
json('artifact-sha256.json', Object.fromEntries(files.map(file => [file, sha(readFileSync(resolve(output, file)))])));
console.log(JSON.stringify({output, cases: neutralTextCases.length, sourceFiles: sourcePaths.length}));
