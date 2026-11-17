import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {nativeFollowup as identity} from './native-followup-evidence.mjs';
import {validateNativeFollowupMain} from './native-followup-main-evidence.mjs';

const [input] = process.argv.slice(2); assert(isAbsolute(input ?? ''));
const root = resolve(import.meta.dirname, '../..'), base = resolve(root, identity.folder, 'main');
assert(!existsSync(base)); mkdirSync(resolve(base, 'replay'), {recursive: true}); mkdirSync(resolve(base, 'capture-diagnostics'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = [], copy = (from, file, target = file) => {copyFileSync(resolve(from, file), resolve(base, target)); files.push(target);};
const save = (file, bytes) => {writeFileSync(resolve(base, file), bytes, {flag: 'wx'}); files.push(file);};
const gh = args => execFileSync('gh', args, {timeout: 60_000});
save('native-run.json', gh(['run', 'view', String(identity.workflowId), '--repo', 'MohamedRed/Sports-Green-Moove',
  '--json', 'databaseId,headSha,status,conclusion,jobs,url']));
save('artifact.json', gh(['api', 'repos/MohamedRed/Sports-Green-Moove/actions/artifacts/12976272774']));
const ordinary = resolve(input, 'outputs/store-review-screenshots');
for (const file of ['ordinary-results.json', 'ordinary-instrumentation.txt', 'native-suite-status.json']) copy(ordinary, file);
copy(ordinary, 'disposable-store-restore.json', 'device-restoration.json');
const replay = resolve(input, 'outputs/local-ui-evidence/6f879e4db5cb570cbab029257d75fff1');
for (const file of readdirSync(replay).filter(file => file === 'results.json' || file.endsWith('-instrumentation.txt') || /^adb-pull-.*\.json$/.test(file)))
  copy(replay, file, 'replay/' + file);
const diagnostics = resolve(ordinary, 'capture-timing/primary-capture-diagnostics');
for (const file of readdirSync(diagnostics)) copy(diagnostics, file, 'capture-diagnostics/' + file);
const sources = {};
for (const file of ['.github/workflows/native-ci.yml', 'scripts/qa/run-ordinary-android-ui.mjs',
  'scripts/run-android-ui-tests-and-collect-screenshots.sh', ...['TeamConversationFlowTest.kt', 'TeamChatComponentCapture.kt',
    'LocalUiCapture.kt', 'PrimaryCaptureProbe.kt', 'PrimaryCaptureDiagnostics.kt'].map(file => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + file)]) {
  const bytes = execFileSync('git', ['show', identity.head + ':' + file]), sha = hash(bytes);
  const archive = resolve(root, 'docs/release/evidence/source-archive', sha + '.txt');
  if (existsSync(archive)) assert.deepEqual(readFileSync(archive), bytes); else writeFileSync(archive, bytes, {flag: 'wx'});
  sources[file] = sha;
}
save('source-sha256.json', JSON.stringify(sources, null, 2) + '\n');
save('artifact-sha256.json', JSON.stringify(Object.fromEntries(files.map(file => [file, hash(readFileSync(resolve(base, file)))])), null, 2) + '\n');
validateNativeFollowupMain(root);
console.log('Original ordinary capture failure, forty passing integrated replay cases and verified restoration retained separately.');
