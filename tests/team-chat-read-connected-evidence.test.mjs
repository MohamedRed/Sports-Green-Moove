import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateRetainedConnectedTeamReads } from '../scripts/qa/team-read-connected-evidence.mjs';

const source = 'docs/release/evidence/team-read-connected-2026-10-21/team-conversation-results.json';
test('connected read execution retains exact successful job, originals, independent records and restoration', () => {
  const run = validateRetainedConnectedTeamReads(process.cwd(), source);
  assert.equal(run.unreadStateVerified, true); assert.equal(run.physicalDevice, false);
  assert(readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8')
    .includes('tests/team-chat-read-connected-evidence.test.mjs'));
});
for (const [file, key, value] of [['team-conversation-results.json', 'unreadStateVerified', false],
  ['team-conversation-results.json', 'notificationsVerified', true], ['team-conversation-results.json', 'physicalDevice', true],
  ['team-conversation-results.json', 'isolatedEnvironmentDestroyed', false], ['job.json', 'conclusion', 'failure'],
  ['artifact.json', 'digest', 'sha256:' + '0'.repeat(64)], ['disposable-device-restore.json', 'verified', false]])
  test(`connected read evidence rejects unsupported ${file}:${key}`, () => {
    assert.throws(() => validateRetainedConnectedTeamReads(process.cwd(), source, path => {
      const bytes = readFileSync(path); if (!path.endsWith('/' + file)) return bytes;
      const changed = JSON.parse(bytes); changed[key] = value; return Buffer.from(JSON.stringify(changed));
    }));
  });
