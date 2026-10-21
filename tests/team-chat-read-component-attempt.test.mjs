import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateTeamReadComponentAttempt } from '../scripts/qa/team-read-component-attempt.mjs';

const source = 'docs/release/evidence/team-read-component-attempt-2026-10-21/results.json';
test('two selector failures and one passing component retain the broader failed job and independent cleanup', () => {
  const run = validateTeamReadComponentAttempt(process.cwd(), source);
  assert.equal(run.componentCases.filter(row => row.status === 'passed').length, 1);
});
for (const [key, value] of [['completed', true], ['physicalDevice', true], ['notificationsVerified', true],
  ['publishedCaptures', ['team-read-count-narrow.png']]])
  test(`failed component evidence cannot promote ${key}`, () => {
    assert.throws(() => validateTeamReadComponentAttempt(process.cwd(), source, path => {
      const bytes = readFileSync(path); if (!path.endsWith('/results.json')) return bytes;
      const changed = JSON.parse(bytes); changed[key] = value; return Buffer.from(JSON.stringify(changed));
    }));
  });
