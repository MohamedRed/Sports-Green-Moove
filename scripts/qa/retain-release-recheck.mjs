import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {releaseRecheckFolder, releaseRecheckHead, validateReleaseRecheck} from './release-recheck-evidence.mjs';

const [input] = process.argv.slice(2); assert(isAbsolute(input ?? ''));
const root = resolve(import.meta.dirname, '../..'), base = resolve(root, releaseRecheckFolder);
assert(!existsSync(resolve(base, 'artifact-sha256.json')), 'Never overwrite an original collection');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (file, bytes) => {
  mkdirSync(resolve(base, file, '..'), {recursive: true});
  writeFileSync(resolve(base, file), typeof bytes === 'string' || Buffer.isBuffer(bytes) ? bytes : JSON.stringify(bytes, null, 2) + '\n', {flag: 'wx'});
};
const copy = (from, to) => {mkdirSync(resolve(base, to, '..'), {recursive: true}); copyFileSync(from, resolve(base, to), 1);};
const gh = args => execFileSync('gh', args, {encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
for (const [name, id] of [['native', 41074069057], ['backend', 41074068981], ['web', 41074069270], ['release', 41074069552], ['transport', 41074069365]])
  save(`${name}-run.json`, gh(['run', 'view', String(id), '--repo', 'MohamedRed/Sports-Green-Moove', '--json', 'databaseId,headSha,status,conclusion,jobs,url']));
save('main-artifact.json', gh(['api', 'repos/MohamedRed/Sports-Green-Moove/actions/artifacts/12987403902']));
save('pr.json', gh(['pr', 'view', '1', '--repo', 'MohamedRed/Sports-Green-Moove', '--json', 'headRefOid,mergeStateStatus,statusCheckRollup']));
const ordinary = resolve(input, 'b8886ec-main/outputs/store-review-screenshots');
for (const file of ['ordinary-instrumentation.txt', 'ordinary-results.json', 'native-suite-status.json',
  'disposable-device-setup.json', 'disposable-store-restore.json']) copy(resolve(ordinary, file), file);
for (const file of readdirSync(resolve(ordinary, 'capture-timing/primary-capture-diagnostics')))
  copy(resolve(ordinary, 'capture-timing/primary-capture-diagnostics', file), 'captures/' + file);
const replay = resolve(input, 'b8886ec-main/outputs/local-ui-evidence/b4e1b85f8e7b5f4262481e48e1a2f93f');
for (const file of readdirSync(replay).filter(file => file === 'results.json' || file.endsWith('-instrumentation.txt') || /^adb-pull-.*\.json$/.test(file)))
  copy(resolve(replay, file), 'replay/' + file);
for (const [name, id] of [['ride-observation', 12986663039], ['remote-ride-stop', 12986244019], ['team-read-components', 12987271230]]) {
  const from = resolve(input, 'b8886ec-' + name), local = resolve(from, 'local-ui-evidence');
  const runs = readdirSync(local); assert.equal(runs.length, 1);
  for (const file of readdirSync(resolve(local, runs[0])).filter(file => /\.json$|\.png$|instrumentation\.txt$/.test(file)))
    copy(resolve(local, runs[0], file), `${name}/${file}`);
  for (const file of ['disposable-device-setup.json', 'disposable-device-restore.json', `${name}-suite-status.json`])
    copy(resolve(from, 'focused-safety-ui', name, file), `${name}/${file}`);
  save(`${name}/artifact.json`, gh(['api', `repos/MohamedRed/Sports-Green-Moove/actions/artifacts/${id}`]));
}
for (const name of ['submission', 'followup', 'urgent']) copy(resolve(input, `b8886ec-support-${name}.json`), `support/${name}.json`);
for (const file of readdirSync(resolve(input, 'b8886ec-support-web'))) copy(resolve(input, 'b8886ec-support-web', file), 'support/images/' + file);
copy(resolve(input, 'b8886ec-ios-native-local.txt'), 'support/swift-checks.txt');
const listeners = spawnSync('lsof', ['-nP', '-iTCP:9099', '-iTCP:5001', '-iTCP:8080', '-iTCP:9000', '-iTCP:4193', '-sTCP:LISTEN'], {encoding: 'utf8'});
assert.equal(listeners.status, 1); assert.equal(listeners.stdout, ''); assert.equal(listeners.stderr, '');
save('support/listener-closure.json', {scope: 'independent-local-listener-observation-not-remote-device-disposal', observedAt: new Date().toISOString(),
  ports: [9099, 5001, 8080, 9000, 4193], listenersAbsent: true});
const sources = {}, retainSources = value => {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'sourceFiles') for (const [file, hash] of Object.entries(child)) {
      if (sources[file]) assert.equal(sources[file], hash);
      sources[file] = hash;
    } else retainSources(child);
  }
};
for (const entry of readdirSync(base, {recursive: true, withFileTypes: true}).filter(entry => entry.isFile() && entry.name.endsWith('.json')))
  retainSources(JSON.parse(readFileSync(resolve(entry.parentPath, entry.name))));
for (const file of ['.github/workflows/native-ci.yml', 'scripts/run-android-ui-tests-and-collect-screenshots.sh',
  'scripts/qa/run-ordinary-android-ui.mjs', 'scripts/qa/local-support-submission-suite.mjs', 'scripts/qa/local-support-followup-suite.mjs',
  'scripts/qa/local-support-followup-browser.mjs', 'scripts/qa/local-support-urgent-suite.mjs', 'scripts/check-ios-native-plan.sh']) {
  const bytes = execFileSync('git', ['show', releaseRecheckHead + ':' + file]); sources[file] = sha(bytes);
}
for (const [file, hash] of Object.entries(sources)) {
  const bytes = execFileSync('git', ['show', releaseRecheckHead + ':' + file], {maxBuffer: 4 * 1024 * 1024}); assert.equal(sha(bytes), hash, file);
  const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (existsSync(archive)) assert.deepEqual(readFileSync(archive), bytes); else writeFileSync(archive, bytes, {flag: 'wx'});
}
save('source-sha256.json', sources);
save('summary.json', {sourceCommit: releaseRecheckHead, scope: 'completed-local-automated-gate-not-physical-or-release-readiness',
  fullEnabledCiPassed: true, supportChecksPassed: 41, releaseComplete: false, physicalDeviceAccepted: false,
  rootCauseProven: false, productionWrites: false, realEmailSent: false, newPublicMedia: []});
const hashes = {};
for (const entry of readdirSync(base, {recursive: true, withFileTypes: true}).filter(entry => entry.isFile())) {
  const path = resolve(entry.parentPath, entry.name); if (entry.name !== 'README.md') hashes[path.slice(base.length + 1)] = sha(readFileSync(path));
}
save('artifact-sha256.json', hashes);
console.log(JSON.stringify(validateReleaseRecheck(root)));
