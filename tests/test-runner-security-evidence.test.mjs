import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateTestRunnerSecurity, testRunnerSecurityFolder } from '../scripts/qa/test-runner-security-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

test('runner security evidence retains reproduction, compatibility and the remaining findings', () => {
  assert.deepEqual(validateTestRunnerSecurity(new URL('..', import.meta.url).pathname),
    { criticalFindings: 0, totalFindings: 30, releaseComplete: false });
  assert(content.updates.some(row => row.source === testRunnerSecurityFolder + 'README.md'));
  const blocker = content.blockers.find(row => row.id === 'dependency-security');
  assert.equal(blocker.source, testRunnerSecurityFolder + 'README.md');
  assert.match(blocker.text, /D’autres alertes restent/);
  const workflow = readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8');
  for (const file of ['tests/test-runner-security-contract.test.mjs', 'tests/test-runner-security-evidence.test.mjs'])
    assert(workflow.includes(`node --test ${file}`) || workflow.includes(` ${file}`));
});
