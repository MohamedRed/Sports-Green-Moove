import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateRetainedTeamReadComponents } from '../scripts/qa/team-read-component-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';
import { detail } from '../partner-portal/src/render.js';

const source = 'docs/release/evidence/team-read-components-2026-10-21/results.json';
test('three native read components retain originals, nineteen separate units and five scoped reviewed images', () => {
  const run = validateRetainedTeamReadComponents(process.cwd(), source);
  const flow = content.flows.find(item => item.id === 'team-conversation');
  assert.equal(flow.readComponents.source, source); assert.equal(flow.status, 'partial');
  assert.equal(flow.latestEvidence, 'phone'); assert.match(detail(flow), /Essai sur téléphone du/);
  assert.deepEqual(flow.tour.filter(step => step.image.startsWith('team-read-verified-')).map(step => step.image),
    Object.keys(run.publishedCaptures));
  for (const [id, file] of Object.entries(run.publishedCaptures)) {
    assert.equal(captures[id], 'docs/release/evidence/team-read-components-2026-10-21/' + file);
    assert.match(flow.images.find(image => image.file === id).alt, /local simulé/);
  }
  assert.equal(flow.phone.source, 'docs/release/evidence/team-draft-phone-2026-10-21/results.json');
});
for (const [file, key, value] of [['results.json', 'connectedBackend', true], ['results.json', 'physicalDevice', true],
  ['results.json', 'notificationsVerified', true], ['results.json', 'componentCaseCount', 2],
  ['job.json', 'conclusion', 'failure'], ['disposable-device-restore.json', 'verified', false],
  ['visual-review.json', 'videoRecorded', true], ['visual-review.json', 'fullAppSystemInsetsVerified', true]])
  test(`read component proof rejects unsupported ${file}:${key}`, () => {
    assert.throws(() => validateRetainedTeamReadComponents(process.cwd(), source, path => {
      const bytes = readFileSync(path); if (!path.endsWith('/' + file)) return bytes;
      const changed = JSON.parse(bytes); changed[key] = value; return Buffer.from(JSON.stringify(changed));
    }));
  });
