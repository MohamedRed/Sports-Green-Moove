import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [trial, destination] = process.argv.slice(2);
assert([trial, destination].every(path => path?.startsWith('/'))); assert(!existsSync(destination));
mkdirSync(destination, {recursive: true});
const write = (file, value) => writeFileSync(resolve(destination, file), JSON.stringify(value, null, 2) + '\n');
for (const [source, target] of [['service-tests.json', 'service-tests.json'], ['service-tests-recheck.log', 'service-tests.log'],
  ['native-build.log', 'native-build.log'], ['root-node-recheck.tap', 'root-tests.tap']]) copyFileSync(resolve(trial, source), resolve(destination, target));
mkdirSync(resolve(destination, 'unit'));
for (const name of ['ui.NotificationReadStateTest', 'services.NotificationReadReceiptTest']) {
  const file = `TEST-be.sportgreenmoove.app.${name}.xml`;
  copyFileSync(resolve('android/app/build/test-results/testDebugUnitTest', file), resolve(destination, 'unit', file));
}
const commit = 'b0677594a01d754b1b7cd18559c7639e5bdf50c5';
const files = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', commit], {encoding: 'utf8'}).trim().split('\n');
const sources = {};
for (const file of files) {
  const bytes = execFileSync('git', ['show', `${commit}:${file}`]);
  const target = resolve(destination, 'source', file + '.txt'); mkdirSync(resolve(target, '..'), {recursive: true});
  writeFileSync(target, bytes); sources[file] = createHash('sha256').update(bytes).digest('hex');
}
write('source-sha256.json', sources);
write('summary.json', {checkedAt: '2026-10-23', scope: 'local-notification-acknowledgement-services-and-state-not-connected-ui',
  sourceCommit: commit, serviceTestsPassed: 19, nativeStateTestsPassed: 10, rootTestsPassed: 1798,
  uiTestsPrepared: 3, uiTestApkBuilt: true, nativeUiExecuted: false, phoneTrialCompleted: false,
  pushDeliveryAccepted: false, iosAccepted: false, productionDeployed: false, productionWrites: false, releaseComplete: false,
  firstAttempt: 'Rules passed; callable suite failed before execution because an unrelated realtime database import required its URL. The callable now imports only its Firestore dependency.',
  secondAttempt: 'Standalone command lacked the workspace Vitest PATH. The retained npm-exec attempt completed all 19 cases.',
  initialRootHarnessFailure: '23 shell-harness assertions failed because the new required capture fixtures were absent; the harness now includes them and nine additional fail-closed copy cases.'});
const hashes = {};
function hash(folder = '') {
  for (const entry of readdirSync(resolve(destination, folder), {withFileTypes: true})) {
    const file = folder ? folder + '/' + entry.name : entry.name;
    if (entry.isDirectory()) hash(file);
    else hashes[file] = createHash('sha256').update(readFileSync(resolve(destination, file))).digest('hex');
  }
}
hash(); write('artifact-sha256.json', hashes);
console.log('Retained isolated local acknowledgement checks, without a phone or push claim.');
