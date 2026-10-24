import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateRetainedTeamReads } from '../scripts/qa/team-read-retained-evidence.mjs';

const source = 'docs/release/evidence/team-read-services-2026-10-21/services.json';
test('read evidence retains twelve service scenarios and sixteen native units without app execution acceptance', () => {
  const run = validateRetainedTeamReads(process.cwd(), source);
  assert.equal(run.steps.length, 12); assert.equal(run.nativeUiExecuted, false);
});
for (const [file, key, value] of [['services.json', 'nativeUiExecuted', true], ['services.json', 'physicalDevice', true],
  ['services.json', 'notificationsVerified', true], ['services.json', 'productionWrites', true],
  ['services.json', 'completed', false], ['services.json', 'adminClientClosed', false],
  ['services.json', 'isolatedEnvironmentDestroyed', false], ['services.json', 'steps', []]])
  test(`service evidence cannot promote or omit ${key}`, () => {
    assert.throws(() => validateRetainedTeamReads(process.cwd(), source, path => {
      const bytes = readFileSync(path); if (!path.endsWith('/' + file)) return bytes;
      const changed = JSON.parse(bytes); changed[key] = value; return Buffer.from(JSON.stringify(changed));
    }));
  });
test('native unit failure cannot be hidden in the retained service evidence', () => {
  assert.throws(() => validateRetainedTeamReads(process.cwd(), source, path => {
    const bytes = readFileSync(path);
    return path.endsWith('/TeamConversationReadStateTest.xml') ? Buffer.from(bytes.toString().replace('failures="0"', 'failures="1"')) : bytes;
  }));
});
