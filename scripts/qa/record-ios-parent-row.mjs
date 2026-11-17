import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {validateIosFixtureRecheck} from './ios-fixture-recheck.mjs';

const root = resolve(import.meta.dirname, '../..'), [log] = process.argv.slice(2);
assert.equal(process.argv.length, 3); assert(isAbsolute(log ?? ''));
const folder = 'docs/release/evidence/ios-parent-row-2026-11-07/', output = resolve(root, folder);
const prior = 'docs/release/evidence/ios-fixture-recheck-dd09f35-2026-11-07/';
const read = path => readFileSync(resolve(root, path)), sha = value => createHash('sha256').update(value).digest('hex');
const failedGate = {source: prior + 'summary.json', sha256: sha(read(prior + 'summary.json'))};
const result = validateIosFixtureRecheck(root, failedGate);
assert.equal(result.passed, 9); assert.equal(result.failed, 2); assert.equal(result.assertionFailures, 3);
const path = 'ios/Sources/SportsGreenMooveApp/ParentReservationsScreen.swift';
const originalHash = JSON.parse(read(prior + 'source-sha256.json')).files.find(row => row.path === path).sha256;
const original = read('docs/release/evidence/source-archive/' + originalHash + '.txt').toString();
const current = read(path).toString(), addition = '            .accessibilityElement(children: .contain)\n';
assert.equal(current.replace(addition, ''), original);
const selected = readFileSync(log, 'utf8').split('\n').filter(line =>
  /Button, identifier: 'reservations\.(row|refresh)|No matches found.*reservations\.cancel\.parent-reservation/.test(line));
assert.equal(selected.length, 3);
assert(selected.some(line => line.includes("identifier: 'reservations.row.parent-reservation', label: 'Annuler la réservation'")));
assert(!existsSync(output)); mkdirSync(output);
const records = [];
function save(name, bytes) {
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  writeFileSync(resolve(output, name), bytes, {flag: 'wx'}); records.push({file: name, sha256: sha(bytes)});
}
save('original-button-snapshot.txt', selected.join('\n') + '\n');
const files = [{path, commit: result.sourceCommit, sha256: originalHash}];
for (const source of [path, 'ios/UITests/SportsGreenMooveUITests/ParentReservationFlowChecks.swift']) {
  const bytes = read(source), hash = sha(bytes), archived = resolve(root, 'docs/release/evidence/source-archive/' + hash + '.txt');
  if (!existsSync(archived)) writeFileSync(archived, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(archived)), hash); files.push({path: source, commit: 'candidate', sha256: hash});
}
save('source-sha256.json', JSON.stringify({files}, null, 2) + '\n');
save('summary.json', JSON.stringify({checkedAt: '2026-11-07', failedGate, sdkBuild: 'success',
  passedCases: 9, failedCases: 2, assertionFailures: 3, failedCommand: 'reservations.cancel.parent-reservation',
  observedCommandIdentifier: 'reservations.row.parent-reservation', candidate: 'explicit-row-accessibility-containment',
  originalActionAndAssertionsPreserved: true, originalCases: 11, deadlineMinutes: 50, newCaptures: 0,
  correctedSdkUiAccepted: false, runtimeCauseConfirmedByComparison: false, physicalDeviceAccepted: false,
  releaseComplete: false, records: [...records]}, null, 2) + '\n');
console.log(JSON.stringify({source: folder + 'summary.json', sha256: sha(read(folder + 'summary.json'))}));
