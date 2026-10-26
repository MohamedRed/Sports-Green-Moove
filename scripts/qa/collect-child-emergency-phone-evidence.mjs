import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { childEmergencyPhonePhases } from './child-emergency-phone-checkpoints.mjs';

const [privateDirectory, observerDirectory, runtimeDirectory, output] = process.argv.slice(2);
for (const path of [privateDirectory, observerDirectory, runtimeDirectory, output]) assert(isAbsolute(path ?? ''));
assert(!existsSync(output)); assert(!existsSync(resolve(privateDirectory, 'session.json')));
const read = (directory, file) => JSON.parse(readFileSync(resolve(directory, file)));
const report = read(observerDirectory, 'session-results.json'), baseline = read(observerDirectory, 'baseline.json');
assert.equal(report.completed, true); assert.equal(report.projectId, 'demo-sgm-local-qa');
const cleanup = read(runtimeDirectory, 'runtime-cleanup.json'); assert.equal(cleanup.failed, false);
for (const key of ['processGroupExited', 'privateSessionAbsent', 'runtimeAbsent', 'endpointsClosed']) assert.equal(cleanup[key], true);
mkdirSync(output, { recursive: true }); mkdirSync(resolve(output, 'captures'));
for (const file of ['session-results.json', 'fixture-ready.json', ...childEmergencyPhonePhases.map(phase => phase + '.json')])
  cpSync(resolve(observerDirectory, file), resolve(output, file), { errorOnExist: true, force: false });
cpSync(resolve(runtimeDirectory, 'runtime-cleanup.json'), resolve(output, 'runtime-cleanup.json'), { errorOnExist: true, force: false });
for (const file of ['contact-ready.png', 'location-denied.png', 'handoff-unresolved.png'])
  cpSync(resolve(privateDirectory, 'captures', file), resolve(output, 'captures', file), { errorOnExist: true, force: false });
const fixture = report.fixture;
writeFileSync(resolve(output, 'contact-records.json'), JSON.stringify({ projectId: report.projectId, runId: report.runId,
  scope: 'sanitized-baseline-contact-projection-not-ui-or-full-record-replay',
  link: baseline.documents.childAccountLinks.find(row => row.id === fixture.childUid), contactView: baseline.contactView,
  claims: baseline.claims.find(row => row.uid === fixture.childUid) }, null, 2) + '\n', { flag: 'wx' });
const root = resolve(import.meta.dirname, '../..'), archive = resolve(root, 'docs/release/evidence/source-archive');
for (const [file, hash] of Object.entries(report.sourceFiles)) {
  const bytes = readFileSync(resolve(root, file)); assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
  const target = resolve(archive, hash + '.txt');
  if (existsSync(target)) assert.equal(createHash('sha256').update(readFileSync(target)).digest('hex'), hash);
  else writeFileSync(target, bytes, { flag: 'wx' });
}
console.log('Copied only reviewed synthetic contact evidence and executed observer sources; no private credentials or logs.');
