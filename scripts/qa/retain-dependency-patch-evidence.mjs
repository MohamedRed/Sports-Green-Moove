import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import net from 'node:net';
import {dependencyPatchFolder, validateDependencyPatchEvidence} from './dependency-patch-evidence.mjs';

const root = resolve(import.meta.dirname, '../..'), base = resolve(root, dependencyPatchFolder);
assert(!existsSync(resolve(base, 'summary.json')));
mkdirSync(resolve(base, 'previous-ci'), {recursive: true});
const save = (name, value) => writeFileSync(resolve(base, name), JSON.stringify(value, null, 2) + '\n');
const files = {
  'regression-before.txt': '/private/tmp/sgm-dependency-security-before-20261028.txt',
  'regression-after.txt': '/private/tmp/sgm-dependency-security-after-20261028.txt',
  'lock-before.json': '/private/tmp/sgm-dependency-security-before-lock-20261028.json', 'lock-after.json': resolve(root, 'package-lock.json'),
  'audit-all-before.json': '/private/tmp/sgm-dependency-security-audit-before-20261028.json',
  'audit-all-after.json': '/private/tmp/sgm-dependency-security-audit-after-20261028.json',
  'audit-functions-production-before.json': '/private/tmp/sgm-production-audit-20261028.json',
  'audit-functions-production-after.json': '/private/tmp/sgm-functions-security-audit-prod-after-20261028.json',
  'audit-all-production-after.json': '/private/tmp/sgm-dependency-security-audit-prod-after-20261028.json',
  'backend-units.txt': '/private/tmp/sgm-dependency-patch-backend-unit-20261028.txt',
  'build.txt': '/private/tmp/sgm-dependency-patch-build-20261028.txt',
  'streaming.txt': '/private/tmp/sgm-dependency-patch-streaming-20261028.txt',
  'services.json': '/private/tmp/sgm-dependency-patch-services-20261028.json',
  'services-completion.txt': '/private/tmp/sgm-dependency-patch-services-20261028.txt',
  'contention.json': '/private/tmp/sgm-dependency-patch-contention-20261028/results.json',
  'contention-completion.txt': '/private/tmp/sgm-dependency-patch-contention-20261028.txt',
};
for (const [name, source] of Object.entries(files)) cpSync(source, resolve(base, name));
const artifact = '/private/tmp/sgm-a499-chat-network-artifact-20261028/';
const evidence = artifact + 'local-ui-evidence/da119e41e5f3049285e7ae5dfdffca7e/';
cpSync(evidence + 'local-chat-network-ui.json', resolve(base, 'previous-ci/network-marker.json'));
cpSync(evidence + 'LocalChatNetworkFlowTest-instrumentation.txt', resolve(base, 'previous-ci/instrumentation.txt'));
cpSync(artifact + 'focused-safety-ui/chat-network-recovery/disposable-device-restore.json', resolve(base, 'previous-ci/device-restoration.json'));
const job = JSON.parse(execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/jobs/123030965888'], {encoding: 'utf8'}));
save('previous-ci/job.json', Object.fromEntries(['id', 'run_id', 'head_sha', 'name', 'status', 'conclusion', 'html_url', 'started_at', 'completed_at', 'steps'].map(key => [key, job[key]])));
const main = '/private/tmp/sgm-a499-native-main-artifact-20261028/outputs/';
for (const [destination, source] of Object.entries({
  'terminal-run.json': '/private/tmp/sgm-a499-native-terminal-20261028.json',
  'ordinary-components.xml': main + 'androidTest-results/connected/debug/TEST-guarded-components.xml',
  'ordinary-instrumentation.txt': main + 'store-review-screenshots/ordinary-instrumentation.txt',
  'native-suite-status.json': main + 'store-review-screenshots/native-suite-status.json',
  'primary-copy.json': main + 'local-ui-evidence/92247864d4bf2c819e131216553d22e3/adb-pull-trip-consent-recovery.json',
})) cpSync(source, resolve(base, 'previous-ci', destination));
const runtimes = ['services', 'contention'].map(name => {
  const log = readFileSync(resolve(base, name + '-completion.txt'), 'utf8');
  const path = log.match(/Watching "([^"\n]*sgm-local-runtime-[^/"\n]+)\/functions"/)?.[1];
  assert(path, 'Retain the original owned runtime identity'); assert(!existsSync(path)); return path;
});
for (const port of [5001, 8080, 9000, 9099]) await new Promise((yes, no) => {
  const server = net.createServer(); server.once('error', no);
  server.listen(port, '127.0.0.1', () => server.close(error => error ? no(error) : yes()));
});
const processes = execFileSync('/bin/ps', ['-axo', 'pid=,command='], {encoding: 'utf8'});
const cwd = spawnSync('/usr/sbin/lsof', ['-a', '-u', String(process.getuid()), '-d', 'cwd', '-Fpn'], {encoding: 'utf8'});
assert.equal(cwd.status, 0);
for (const path of runtimes) {assert(!processes.includes(path)); assert(!cwd.stdout.includes(path));}
save('disposal.json', {checkedAt: new Date().toISOString(), commandExitCodes: {services: 0, contention: 0},
  endpointsClosed: true, ownedProcessesAbsent: true, runtimePathsAbsent: true, runtimes,
  method: 'closed-endpoint-bind-tests-and-no-owned-runtime-command-or-cwd-references-after-successful-launcher-exits'});
assert.equal(execFileSync('git', ['diff', '--', 'functions/src', 'android/app/src/main'], {cwd: root, encoding: 'utf8'}), '');
const sourceFiles = ['tests/dependency-security-contract.test.mjs', 'tests/helpers/dependency-security-probe.mjs',
  'functions/src/lib/firestore.ts', 'functions/src/callables/bookings.ts'];
const hashes = Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]));
save('source-files.json', hashes);
for (const [file, hash] of Object.entries(hashes)) {
  const destination = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(destination)) cpSync(resolve(root, file), destination);
}
save('summary.json', {scope: 'installed-dependency-regressions-and-local-business-compatibility-not-production-exploit-or-release-clearance',
  checkedAt: '2026-10-28', baselineCommit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
  cases: 18, failuresBefore: 12, failuresAfter: 0, changedLockEntries: 8, backendUnitCases: 501, serviceGroups: 24,
  controlledOverlaps: 12, streamingContracts: 7, allWorkspaceAuditBefore: 38, allWorkspaceAuditAfter: 33,
  remainingAllWorkspaceCritical: 2, functionsProductionAuditBefore: 16, functionsProductionAuditAfter: 10,
  functionsProductionHighBefore: 6, functionsProductionHighAfter: 0, providerMapRequests: 0,
  sameRegressionSources: true, sameMajorUpdatesOnly: true, businessCodeUnchanged: true, applicationsBuilt: true,
  localRuntimeDisposed: true, productionExploitProven: false, allSecurityFindingsResolved: false,
  productionDeployed: false, physicalUiVerified: false, realPayments: false, releaseComplete: false,
  nativeNetworkPreparationCauseProven: false, nativeFailureRepairedByDependencyPatch: false});
const artifacts = {}, walk = directory => {for (const entry of readdirSync(resolve(base, directory), {withFileTypes: true})) {
  const name = directory ? directory + '/' + entry.name : entry.name;
  if (entry.isDirectory()) walk(name);
  else if (!['artifact-sha256.json', 'README.md'].includes(name))
    artifacts[name] = createHash('sha256').update(readFileSync(resolve(base, name))).digest('hex');
}}; walk(''); save('artifact-sha256.json', artifacts);
console.log(JSON.stringify(validateDependencyPatchEvidence(root)));
