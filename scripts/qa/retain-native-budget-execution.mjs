import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {nativeBudgetExecutionFolder, nativeBudgetExecutionHead, validateNativeBudgetExecution} from './native-budget-execution-evidence.mjs';

const [input] = process.argv.slice(2); assert(isAbsolute(input ?? ''));
const root = resolve(import.meta.dirname, '../..'), base = resolve(root, nativeBudgetExecutionFolder);
assert(!existsSync(base), 'Never overwrite retained evidence'); mkdirSync(base, {recursive: true});
const save = (file, bytes) => {
  mkdirSync(resolve(base, file, '..'), {recursive: true});
  writeFileSync(resolve(base, file), typeof bytes === 'string' || Buffer.isBuffer(bytes) ? bytes : JSON.stringify(bytes, null, 2) + '\n', {flag: 'wx'});
};
const copy = (from, to) => {mkdirSync(resolve(base, to, '..'), {recursive: true}); copyFileSync(from, resolve(base, to), 1);};
const gh = args => execFileSync('gh', args, {encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
save('native-run.json', readFileSync(resolve(input, '91c4a09-native-run.json')));
save('pr-checks.json', readFileSync(resolve(input, '91c4a09-checks.json')));
save('artifact.json', gh(['api', 'repos/MohamedRed/Sports-Green-Moove/actions/artifacts/13001604158']));
save('source-native-ci.yml.txt', execFileSync('git', ['show', nativeBudgetExecutionHead + ':.github/workflows/native-ci.yml']));
const ordinary = resolve(input, '91c4a09-main/outputs/store-review-screenshots');
for (const file of ['ordinary-instrumentation.txt', 'ordinary-results.json', 'ordinary-process.json', 'native-suite-status.json'])
  copy(resolve(ordinary, file), file);
copy(resolve(ordinary, 'disposable-store-restore.json'), 'device-restore.json');
const artifact = resolve(input, '91c4a09-main'), replay = resolve(artifact, 'outputs/local-ui-evidence/4d6379013b702177a5eec8c1e82d6024');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
save('artifact-inventory.json', readdirSync(artifact, {recursive: true, withFileTypes: true}).filter(entry => entry.isFile()).map(entry => {
  const path = resolve(entry.parentPath, entry.name); return {path: path.slice(artifact.length + 1), sha256: sha(readFileSync(path))};
}).sort((a, b) => a.path.localeCompare(b.path)));
for (const file of readdirSync(replay).filter(file => file.endsWith('-instrumentation.txt') || /^adb-pull-.*\.json$/.test(file)
  || file === 'adb-sync-trip-consent-restart-diagnostics.json')) copy(resolve(replay, file), 'replay/' + file);
save('summary.json', {sourceCommit: nativeBudgetExecutionHead,
  scope: 'failed-new-budget-gate-with-primary-transfer-interruption-not-timeout-or-release-proof',
  outerBudgetMinutes: 50, mainJobSeconds: 1237, ordinaryPassed: 205, partialReplayCasesPassed: 29,
  successfulPrimaryCopies: 10, focusedJobsPassed: 11, deviceRestorationVerified: true,
  fullGatePassed: false, completeReplayAccepted: false, rootCauseConfirmed: false,
  physicalDeviceAccepted: false, releaseAccepted: false, publicMedia: []});
save('artifact-sha256.json', Object.fromEntries(readdirSync(base, {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile()).map(entry => {
    const path = resolve(entry.parentPath, entry.name); return [path.slice(base.length + 1), sha(readFileSync(path))];
  })));
console.log(JSON.stringify(validateNativeBudgetExecution(root)));
