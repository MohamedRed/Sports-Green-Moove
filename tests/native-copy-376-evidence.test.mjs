import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {copy376Folder, validateCopy376Evidence} from '../scripts/qa/native-copy-376-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';
import {validateIosFixtureGate} from '../scripts/qa/ios-fixture-release-evidence.mjs';

const root = resolve(import.meta.dirname, '..'), sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('the verified consent stage remains distinct from the later incomplete input stage and full matrix', () => {
  const report = validateCopy376Evidence(root);
  assert.equal(report.consentStageVerified, true); assert.equal(report.inputsHostStageVerified, false);
  assert.equal(report.copyRootCauseConfirmed, false); assert.equal(report.fullReplayAccepted, false);
  const folder = 'docs/release/evidence/ios-fixture-gate-04c9fba-2026-11-06/';
  const proof = folder + 'summary.json', read = path => readFileSync(resolve(root, path));
  const ios = validateIosFixtureGate(root, {source: proof, sha256: sha(read(proof))}, {matchCurrentSources: false});
  assert.equal(ios.sourceCommit, '04c9fba781897bb8e567475b845f42bcc7beb658'); assert.equal(ios.passedCases, 11);
  assert.deepEqual(JSON.parse(read(folder + 'build-input-sha256.json')),
    JSON.parse(read('docs/release/evidence/ios-fixture-gate-376addb-2026-11-06/build-input-sha256.json')));
});
for (const [file, change] of [
  ['summary.json', row => row.primaryCopyPassed = true], ['summary.json', row => row.inputsHostStageVerified = true],
  ['summary.json', row => row.copyRootCauseConfirmed = true], ['summary.json', row => row.daemonRestartProven = true],
  ['summary.json', row => row.fullReplayAccepted = true], ['summary.json', row => row.physicalDeviceAccepted = true],
  ['primary-copy.json', row => row.completed = true], ['cleanup-copy.json', row => row.completed = false],
  ['sync-diagnostics.json', row => row.observations[0].stderr = 'different failure'],
  ['consent-stage.json', row => row.records[0].decisionCount = 1], ['original-archive.json', row => row.absentMembers = []],
  ['artifact-metadata.json', row => row.digest = 'sha256:' + '0'.repeat(64)],
  ['later-prerequisite-outcome.json', row => row.flowCompleted = true],
  ['later-prerequisite-archive.json', row => row.conclusion = 'success'],
  ['later-prerequisite-archive.json', row => row.members[0].file = '../outside'],
]) test('even rehashed copy evidence rejects ' + change.toString(), t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-copy376-proof-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  const base = resolve(temp, copy376Folder); cpSync(resolve(root, copy376Folder), base, {recursive: true});
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), resolve(temp, 'docs/release/evidence/source-archive'));
  const path = resolve(base, file), row = JSON.parse(readFileSync(path)); change(row); writeFileSync(path, JSON.stringify(row));
  const hashes = JSON.parse(readFileSync(resolve(base, 'artifact-sha256.json'))); hashes[file] = sha(readFileSync(path));
  writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes)); assert.throws(() => validateCopy376Evidence(temp));
});
test('the historical public note keeps its simulation scope after newer publication results arrive', () => {
  const {recent, previous} = partitionUpdates(content.updates);
  const note = previous.find(row => row.source === copy376Folder + 'README.md'); assert(note);
  const current = recent.find(row => [row.flow, ...(row.coversFlows ?? [])].includes('publication'));
  assert(current && current.source !== note.source && current.date >= note.date);
  assert.match(note.title, /simulation/); assert.match(note.text, /Deux accords, un refus.*retrait/);
  assert.match(note.text, /complet reste à terminer/); assert.equal(note.flow, 'publication');
  assert.doesNotMatch(note.title + note.text, /Firebase|BrowserStack|Android|SDK|adb|CI\b/);
  assert(content.updates.some(row => row.source === 'docs/release/evidence/native-network-959-comparison-2026-11-06/README.md'));
  assert(content.updates.some(row => row.source === 'docs/release/evidence/native-copy-recheck-2026-11-04/README.md'));
  assert.equal(content.flows.length, 34); assert.equal(content.flows.find(row => row.id === 'publication').status, 'partial');
});
