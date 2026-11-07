import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {content} from '../../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2];
assert(input?.startsWith('/'));
const folder = resolve(root, 'docs/release/evidence/ios-ride-chat-2026-11-05');
assert(!existsSync(resolve(folder, 'summary.json')), 'Retained executions are immutable'); mkdirSync(folder, {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const safe = bytes => assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
const records = [], files = [];
const write = (name, bytes) => { safe(bytes); writeFileSync(resolve(folder, name), bytes, {flag: 'wx'}); };
const retain = (name, bytes) => { write(name, bytes); records.push({file: name, sha256: sha(bytes)}); };
const gh = args => execFileSync('/opt/homebrew/bin/gh', args, {cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
const runs = [];
for (const [runId, commit] of [[42043418025, '62f5365485e4e8550231c1d6b2ac8206a2e3a92b'],
  [42047085995, '31a64a773c93701eab72c21886876466e3fe1d2a']]) {
  const run = JSON.parse(gh(['run', 'view', String(runId), '--repo', 'MohamedRed/Sports-Green-Moove', '--json', 'status,conclusion,headSha,jobs']));
  assert.equal(run.status, 'completed'); assert.equal(run.headSha, commit);
  const artifacts = JSON.parse(gh(['api', `repos/MohamedRed/Sports-Green-Moove/actions/runs/${runId}/artifacts`]));
  assert.equal(artifacts.total_count, 0);
  const log = gh(['run', 'view', String(runId), '--repo', 'MohamedRed/Sports-Green-Moove', '--log']);
  const selected = log.split('\n').filter(line => /Test Case '|Executed \d+ tests|: error:|Failed to (connect|clone)|Could not resolve package|Process completed with exit|##\[error\]/.test(line));
  const cases = selected.flatMap(line => {
    const match = line.match(/Test Case '-\[([^ ]+) ([^\]]+)\]' (passed|failed) \(([\d.]+) seconds\)/);
    return match ? [{suite: match[1], name: match[2], status: match[3], seconds: Number(match[4])}] : [];
  });
  const job = run.jobs[0], stage = name => job.steps.find(step => step.name === name)?.conclusion;
  assert.equal(stage('Dispose isolated simulator'), 'success');
  retain(`${runId}-run.json`, json(run)); retain(`${runId}-artifacts.json`, json(artifacts));
  retain(`${runId}-selected.txt`, selected.join('\n') + '\n'); retain(`${runId}-cases.json`, json(cases));
  runs.push({runId, commit, conclusion: run.conclusion, sdkBuild: stage('Compile app and all fixture test bundles'),
    fixtureStep: stage('Run every built fixture test without rebuilding'), plannedCases: 11,
    completedCases: cases.length, passedCases: cases.filter(row => row.status === 'passed').length,
    failedCases: cases.filter(row => row.status === 'failed').length, disposal: 'success', artifactCount: 0});
}
for (const [from, name, marker] of [
  ['sgm-ride-chat-native-v2-20261105.log', 'native-result.txt', 'RideChatBoundaryChecks passed: 84'],
  ['sgm-ride-chat-signature-v3-20261105.log', 'signature-result.txt', 'not an SDK build or phone test'],
  ['sgm-ride-chat-ui-syntax-20261105.log', 'syntax-result.txt', ''],
  ['sgm-ride-chat-adapter-runtime-v1-20261105.log', 'adapter-runtime-result.txt', '11 actual thread adapter invalidations'],
]) {
  const bytes = readFileSync(resolve(input, from)); assert(bytes.toString().includes(marker));
  assert(!/error:|Fatal error|failed:/.test(bytes.toString())); retain(name, bytes);
}
const service = JSON.parse(readFileSync(resolve(input, 'sgm-ride-chat-services-20261105.json')));
assert(service.completed && service.isolatedEnvironmentDestroyed && service.adminClientClosed && service.firestoreClientTerminated);
assert.equal(service.checks.length, 9); assert(service.checks.every(row => row.status === 'passed'));
retain('services.json', json(service));
const app = 'ios/Sources/SportsGreenMooveApp/', checks = 'ios/Tests/SportsGreenMooveNativeChecks/';
const paths = readdirSync(resolve(root, app)).filter(name => /RideChat|PrivateChatDraftFiles/.test(name)).map(name => app + name);
paths.push(...readdirSync(resolve(root, checks)).filter(name => /RideChat/.test(name)).map(name => checks + name));
for (const prefix of ['tests/fixtures/ios-ride-chat-runtime/', 'tests/fixtures/ios-support-concurrency/'])
  paths.push(...readdirSync(resolve(root, prefix)).filter(name => name.endsWith('.swift')).map(name => prefix + name));
paths.push(...['TeamChatModels.swift', 'TeamChatText.swift', 'TeamChatWire.swift', 'TeamChatDraftStore.swift', 'MessagesScreen.swift', 'Models.swift',
  'GatewayContracts.swift', 'FirebaseInboxGateway.swift', 'UITestAppStateFactory.swift', 'AccountWorkScope.swift', 'SecondaryScreens.swift'].map(name => app + name));
paths.push(checks + 'main.swift', checks + 'MessagesInboxChecks.swift',
  'ios/UITests/SportsGreenMooveUITests/RideChatFlowChecks.swift', 'ios/UITests/SportsGreenMooveUITests/SportsGreenMooveUITests.swift',
  'scripts/check-ios-native-plan.sh', 'scripts/check-ios-support-concurrency.sh', 'scripts/qa/check-ios-ride-chat-runtime.sh',
  '.github/workflows/ios-mvp-verification.yml', '.github/workflows/web-integration-smoke.yml');
for (const path of paths) {
  const bytes = readFileSync(resolve(root, path)), hash = sha(bytes); safe(bytes);
  const target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(target)) writeFileSync(target, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(target)), hash); files.push({path, sha256: hash});
}
write('source-sha256.json', json({files}));
write('portal-before.json', json({flows: content.flows.map(row => ({id: row.id, sha256: sha(JSON.stringify(row))})),
  updates: content.updates.map(row => sha(JSON.stringify(row))), blockers: sha(JSON.stringify(content.blockers))}));
write('summary.json', json({checkedAt: '2026-11-05', scope: 'owned-iphone-booking-ride-chat-local-not-sdk-ui-or-provider',
  records, previousRuns: runs, controlledDelayedBoundaries: 84, scriptedThreadAdapterInvalidations: 11,
  separateServiceGroups: 9, localChecks: {nativeExitCode: 0, signatureExitCode: 0, syntaxExitCode: 0, adapterRuntimeExitCode: 0},
  nativeImplementationWired: true, fixtureCases: 11, deadlineMinutes: 50, originalAssertionsRetained: true,
  sdkLinkedBuildAccepted: false, nativeUiAccepted: false, nativeServiceIntegrationAccepted: false,
  physicalDeviceAccepted: false, notificationsAccepted: false, releaseComplete: false,
  newPhoneSessions: 0, providerRequests: 0, productionWrites: 0, newMedia: 0}));
console.log('Retained controlled iPhone booking/ride chat checks, nine separate service groups and exact prior terminal CI results.');
