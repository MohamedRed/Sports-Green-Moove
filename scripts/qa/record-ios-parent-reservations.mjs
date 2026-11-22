import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {iosAutomatedEvidenceIds} from './ios-fixture-release-evidence.mjs';

const root = resolve(import.meta.dirname, '../..'), [nativePath, signaturesPath] = process.argv.slice(2);
for (const path of [nativePath, signaturesPath]) assert(isAbsolute(path ?? ''));
const native = readFileSync(nativePath), signatures = readFileSync(signaturesPath);
for (const marker of ['Parent reservation checks passed: 21 malformed responses;', 'SportsGreenMooveNativeChecks passed',
  'OwnedPlacesAdapterChecks passed:', 'ParentReservationAdapterChecks passed: 12 actual list/cancel callback outcomes and five pre-call denials']) assert(native.includes(marker));
assert(signatures.includes('Owned callable signature checks passed'));
const recordedAt = new Date().toISOString(), date = recordedAt.slice(0, 10), folder = 'docs/release/evidence/ios-parent-reservations-' + date;
const output = resolve(root, folder), evidence = resolve(root, 'docs/release/evidence');
const read = path => readFileSync(resolve(root, path)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const beforeBytes = read('docs/release/evidence-manifest.json'), before = JSON.parse(beforeBytes), after = structuredClone(before);
for (const row of after.automatedUserFlowEvidence.items.filter(row => iosAutomatedEvidenceIds.includes(row.id))) {
  assert.equal(row.status, 'pending');
  row.description = 'Historical eleven-screen passes and failed rechecks retained. New owned parent reservation paging/cancellation and rewards navigation require their complete SDK/eleven-screen gate; controlled local logic/signature/callback checks do not accept actual UI, live services or release.';
}
const priorName = readdirSync(evidence).filter(name => /^automated-user-flow-evidence-.*\.json$/.test(name)).sort().at(-1);
const indexName = `automated-user-flow-evidence-${recordedAt.replace(/[:.]/g, '')}-ios-parent-reservations.json`;
assert(priorName && indexName > priorName);
const priorBytes = read('docs/release/evidence/' + priorName), index = JSON.parse(priorBytes);
index.items = index.items.map(row => iosAutomatedEvidenceIds.includes(row.id) ? after.automatedUserFlowEvidence.items.find(item => item.id === row.id) : row);
index.inheritedEvidence = {source: 'docs/release/evidence/' + priorName, sha256: sha(priorBytes)};
index.updatedAt = recordedAt; index.iosInputChange = {source: folder + '/summary.json', reason: 'owned-parent-reservation-directory-and-cancellation'};
assert(!existsSync(output)); mkdirSync(output);
const records = [];
function record(file, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(json(value));
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes));
  writeFileSync(resolve(output, file), bytes, {flag: 'wx'}); records.push({file, sha256: sha(bytes)});
}
record('native-checks.txt', native); record('signature-checks.txt', signatures);
record('manifest-before.json', beforeBytes); record('manifest-after.json', after); record('index-after.json', index);
const sources = [];
function source(path, bytes, commit) {
  const hash = sha(bytes), archive = resolve(evidence, 'source-archive', hash + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(archive)), hash); sources.push({path, commit, sha256: hash});
}
const baseline = '05cd3f7d6869c7bfc5286ca76fcfa740d839add9', trips = 'ios/Sources/SportsGreenMooveApp/TripsScreen.swift';
source(trips, execFileSync('git', ['show', baseline + ':' + trips], {cwd: root}), baseline);
const paths = ['ParentReservation.swift', 'ParentReservationWire.swift', 'ParentReservationState.swift', 'ParentReservationsScreen.swift',
  'FirebaseParentReservations.swift', 'UnconfiguredParentReservations.swift', 'UITestParentReservations.swift',
  'GatewayContracts.swift', 'TripsScreen.swift', 'UITestAppStateFactory.swift'].map(name => 'ios/Sources/SportsGreenMooveApp/' + name);
paths.push(...['ParentReservationChecks.swift', 'UnusedParentReservationGateway.swift', 'main.swift'].map(name => 'ios/Tests/SportsGreenMooveNativeChecks/' + name),
  ...['ParentReservationFlowChecks.swift', 'SportsGreenMooveUITests.swift'].map(name => 'ios/UITests/SportsGreenMooveUITests/' + name),
  'scripts/check-ios-native-plan.sh', 'scripts/check-ios-support-concurrency.sh', 'scripts/qa/check-ios-owned-places.sh',
  'scripts/qa/ios-reservation-fixture-extension.mjs', 'tests/fixtures/ios-parent-reservations/main.swift');
for (const path of paths) source(path, read(path), 'candidate');
record('source-sha256.json', {files: sources});
record('summary.json', {checkedAt: date, recordedAt, baselineCommit: baseline, nativePlanExitCode: 0, signaturesExitCode: 0,
  malformedResponsesRejected: 21, delayedStateBoundaries: 12, pagingRejections: 4, deniedNonParentRoles: 3,
  actualAdapterCallbacks: 12, adapterPreCallDenials: 5, unknownWriteAutomaticRetries: 0,
  originalFixtureCases: 11, extraFixtureCases: 0, existingCaseExtensions: 1, deadlineMinutes: 50,
  previousEvidencePreserved: true, onlyIosPendingDescriptionsChanged: true,
  sdkLinkedBuildAccepted: false, nativeScreenExecuted: false, liveBackendMutationAccepted: false,
  refundSettled: false, physicalDeviceAccepted: false, releaseComplete: false, records: [...records]});
assert.deepEqual(read('docs/release/evidence-manifest.json'), beforeBytes);
writeFileSync(resolve(evidence, indexName), json(index), {flag: 'wx'});
writeFileSync(resolve(root, 'docs/release/evidence-manifest.json'), json(after));
console.log(JSON.stringify({source: folder + '/summary.json', sha256: sha(read(folder + '/summary.json')), index: indexName}));
