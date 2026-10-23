import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';

const input = process.argv[2];
assert(isAbsolute(input || ''));
const root = resolve(import.meta.dirname, '../..');
const output = resolve(root, 'docs/release/evidence/payout-accounting-2026-10-23');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const write = (file, value) => writeFileSync(resolve(output, file), JSON.stringify(value, null, 2) + '\n');
const copy = (from, to) => { const path = resolve(output, to); mkdirSync(dirname(path), { recursive: true }); copyFileSync(from, path); };
for (const [from, to] of Object.entries({ 'original-red.json': 'harness-failure.json',
  'original-red-behavior.json': 'red-regressions.json', 'final-financial.json': 'green-financial.json',
  'evidence-copy-discovery-failure.json': 'evidence-copy-discovery-failure.json',
  'functions-suite.json': 'green-functions.json', 'component-final/results.json': 'component/results.json',
  'root-node.tap': 'root-node.tap', 'native-run-c1d2a2ff.json': 'native-run.json' })) copy(resolve(input, from), to);
const red = json(resolve(output, 'red-regressions.json'));
assert.equal(red.numFailedTests, 2); assert.equal(red.numPassedTests, 0);
for (const file of ['green-financial.json', 'green-functions.json']) {
  const report = json(resolve(output, file)); assert.equal(report.success, true); assert.equal(report.numFailedTestSuites, 0);
  assert.equal(report.numFailedTests, 0); assert.equal(report.numPendingTests, 0);
}
const component = json(resolve(output, 'component/results.json'));
assert.equal(component.steps.length, 5); assert(component.steps.every(step => step.status === 'passed'));
for (const file of component.screenshots) { assert.equal(file, basename(file)); copy(resolve(input, 'component-final', file), 'component/' + file); }
const native = json(resolve(output, 'native-run.json'));
assert.equal(native.databaseId, 39988296119); assert.equal(native.headSha, 'c1d2a2ff017b89fe498b2537854dc5a64e6d4a0c');
assert.equal(native.status, 'completed'); assert.equal(native.conclusion, 'failure');
const nativeLog = execFileSync('gh', ['run', 'view', String(native.databaseId), '--repo', 'MohamedRed/Sports-Green-Moove',
  '--job', '120533132535', '--log-failed'], { cwd: root, encoding: 'utf8', maxBuffer: 8_000_000 });
writeFileSync(resolve(output, 'native-full-failure-excerpt.txt'), nativeLog.split('\n')
  .filter(line => /ComposeTimeoutException|at be.sportgreenmoove|There was 1 failure|Tests run:/.test(line)).join('\n') + '\n');
const team = 'previous-native-team/local-ui-evidence/6d4b67f60b3cf7f000db1295a9dc8306/LocalTeamConversationFlowTest-instrumentation.txt';
copy(resolve(input, team), 'native-team-instrumentation.txt');
copy(resolve(input, 'previous-native-team/focused-safety-ui/team-conversation/disposable-device-restore.json'), 'native-team-restoration.json');
const sources = ['functions/src/domain/rewards.ts', 'functions/src/__tests__/co2-rewards.test.ts',
  'functions/src/domain/rewardPayout.ts', 'functions/src/services/rewardPayout.ts',
  'functions/src/services/payoutReversals.ts', 'functions/src/services/stripePayoutReconciliation.ts', 'functions/src/callables/payments.ts',
  'admin/src/RewardPayoutRow.tsx', 'admin/src/rewardPayoutRequest.ts', 'admin/src/payouts.css', 'admin/src/actions.ts',
  'admin/src/AdminDashboard.tsx', 'tests/reward-payout-flow.test.ts', 'tests/admin-payout-request.test.ts',
  'tests/stripe-webhook-flow.test.ts', 'tests/fixtures/reward-payout-component.tsx', 'scripts/qa/check-payout-component.mjs'];
const sourceHashes = {};
for (const file of sources) {
  rmSync(resolve(output, 'source', file), { force: true });
  copy(resolve(root, file), 'source/' + file + '.txt'); sourceHashes[file] = hash(readFileSync(resolve(root, file)));
}
write('source-sha256.json', sourceHashes);
for (const file of ['functions/src/callables/payments.ts', 'functions/src/services/stripePayoutReconciliation.ts']) {
  const bytes = execFileSync('git', ['show', `${native.headSha}:${file}`], { cwd: root });
  const path = resolve(output, 'before', file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes);
}
const nodeReport = readFileSync(resolve(output, 'root-node.tap'), 'utf8');
assert.match(nodeReport, /# fail 0\n/); assert.match(nodeReport, /# cancelled 0\n/);
write('summary.json', { checkedAt: new Date().toISOString().slice(0, 10), scope: 'isolated-payout-accounting-not-real-money-or-phone',
  regressionFailuresBefore: red.numFailedTests, financialCasesPassed: json(resolve(output, 'green-financial.json')).numPassedTests,
  backendUnitCasesPassed: json(resolve(output, 'green-functions.json')).numPassedTests, browserComponentChecksPassed: component.steps.length,
  rootNodeCasesPassed: Number(/# pass (\d+)/.exec(nodeReport)[1]), realTransfers: false, productionWrites: false,
  browserToProviderIntegration: false, nativeOrPhysicalPaymentsAccepted: false, releaseComplete: false,
  latestNativeRun: { id: native.databaseId, head: native.headSha, conclusion: native.conclusion, rootCauseEstablished: false } });
const allFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = resolve(directory, entry.name); return entry.isDirectory() ? allFiles(path) : [path];
});
write('artifact-sha256.json', Object.fromEntries(allFiles(output).filter(path => !path.endsWith('/artifact-sha256.json'))
  .map(path => [relative(output, path), hash(readFileSync(path))]).sort(([a], [b]) => a.localeCompare(b))));
console.log(JSON.stringify({ retained: relative(root, output), sourceFiles: sources.length,
  financialCases: json(resolve(output, 'summary.json')).financialCasesPassed, realTransfers: false }));
