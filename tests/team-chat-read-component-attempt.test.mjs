import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validateTeamReadComponentAttempt } from '../scripts/qa/team-read-component-attempt.mjs';

const source = 'docs/release/evidence/team-read-component-attempt-2026-10-21/results.json';
test('two selector failures and one passing component retain the broader failed job and independent cleanup', () => {
  const run = validateTeamReadComponentAttempt(process.cwd(), source);
  assert.equal(run.componentCases.filter(row => row.status === 'passed').length, 1);
  const attributes = execFileSync('git', ['check-attr', 'text', '--', source.replace('results.json', 'suite.xml')], { encoding: 'utf8' });
  assert(attributes.endsWith(': text: unset\n'));
});
for (const [key, value] of [['completed', true], ['physicalDevice', true], ['notificationsVerified', true],
  ['publishedCaptures', ['team-read-count-narrow.png']]])
  test(`failed component evidence cannot promote ${key}`, () => {
    assert.throws(() => validateTeamReadComponentAttempt(process.cwd(), source, path => {
      const bytes = readFileSync(path); if (!path.endsWith('/results.json')) return bytes;
      const changed = JSON.parse(bytes); changed[key] = value; return Buffer.from(JSON.stringify(changed));
    }));
  });

for (const [directory, jobId, artifactId] of [['team-read-layout-attempt-2026-10-21', 119463312769, 12379876312],
  ['team-read-layout-diagnostics-2026-10-21', 119473367031, 12379404206]])
test(`${directory} retains original failed execution and restoration without accepting images`, () => {
  const folder = new URL('../docs/release/evidence/' + directory + '/', import.meta.url);
  const read = file => readFileSync(new URL(file, folder)), json = file => JSON.parse(read(file));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const job = json('job.json'), artifact = json('artifact.json');
  assert.equal(job.id, jobId); assert.equal(job.conclusion, 'failure');
  assert.equal(artifact.id, artifactId); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.digest, 'sha256:' + hash(read('original-artifact.zip')));
  assert.equal(artifact.size_in_bytes, read('original-artifact.zip').length);
  assert.match(read('instrumentation.txt').toString(), /Tests run: 3,  Failures: 2/);
  const restored = json('device-restored.json'); assert.equal(restored.verified, true); assert.equal(restored.restored, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restored.restoration.installAdmin[key], true);
  assert.equal(json('suite-status.json').status, 1);
  for (const [file, expected] of Object.entries(json('artifact-sha256.json'))) assert.equal(hash(read(file)), expected, file);
});
