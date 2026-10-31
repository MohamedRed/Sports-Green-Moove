import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {reviewBaselineGateFolder, reviewBaselineHead, validateReviewBaselineGate} from './review-baseline-gate-evidence.mjs';

const [trial] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..'); assert(isAbsolute(trial ?? ''));
const base = resolve(root, reviewBaselineGateFolder), outputs = resolve(trial, 'baseline-native-artifact/outputs');
assert(!existsSync(base)); mkdirSync(resolve(base, 'replay'), {recursive: true});
const copies = [['baseline-native-run.json', 'native-run.json'], ['baseline-pr-checks.json', 'pr-checks.json'], ['baseline-native-artifact.json', 'artifact.json']];
for (const [from, to] of copies) cpSync(resolve(trial, from), resolve(base, to));
const ordinary = resolve(outputs, 'store-review-screenshots');
for (const file of ['ordinary-instrumentation.txt', 'ordinary-results.json', 'native-suite-status.json']) cpSync(resolve(ordinary, file), resolve(base, file));
cpSync(resolve(ordinary, 'disposable-store-restore.json'), resolve(base, 'device-restoration.json'));
const replay = resolve(outputs, 'local-ui-evidence/a82ed7a3ce4dc3a3221f36df294696c9');
for (const file of readdirSync(replay).filter(file => file === 'results.json' || file.startsWith('adb-pull-') || file.endsWith('-instrumentation.txt')))
  cpSync(resolve(replay, file), resolve(base, 'replay', file));
const save = (file, data) => writeFileSync(resolve(base, file + '.json'), JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
save('summary', {scope: 'complete-enabled-ci-before-review-trip-context-not-current-implementation-release',
  sourceCommit: reviewBaselineHead, ciRunId: 40950260135, nativeGatePassed: true, checkedAt: '2026-10-29',
  newReviewContextCovered: false, physicalDeviceAccepted: false, newMediaAccepted: false, releaseComplete: false,
  earlierTransportRootCauseConfirmed: false, productionWrites: false, safetyAuditAccepted: false});
const hashes = {}, walk = directory => {for (const entry of readdirSync(resolve(base, directory), {withFileTypes: true})) {
  const file = directory ? directory + '/' + entry.name : entry.name;
  if (entry.isDirectory()) walk(file); else hashes[file] = createHash('sha256').update(readFileSync(resolve(base, file))).digest('hex');
}}; walk(''); save('artifact-sha256', hashes); console.log(JSON.stringify(validateReviewBaselineGate(root)));
