import test from 'node:test';
import assert from 'node:assert/strict';
import { content, captures } from '../partner-portal/content.mjs';
import { validateUiScope } from '../partner-portal/validate.mjs';
import { validateRetainedNativeStartup } from '../scripts/qa/native-startup-retained-evidence.mjs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
test('the startup tour publishes only its two usable images and keeps the rendering issue visible', () => {
  const flow = content.flows.find((item) => item.id === 'native-startup');
  assert.equal(flow.status, 'partial'); assert.equal(flow.phone, undefined);
  assert.deepEqual(flow.ui.groups, ['native-tracking-startup']);
  const run = validateRetainedNativeStartup(root, flow.ui.source); validateUiScope(run);
  assert.equal(flow.images.length, 2); assert.equal(flow.tour.length, 2);
  assert.match(flow.remaining, /manque sur deux captures/);
  assert.equal(captures['native-startup-invalid'], undefined); assert.equal(captures['native-startup-resumed'], undefined);
  assert.deepEqual(flow.tour.map((step) => step.image), flow.images.map((image) => image.file));
  for (const image of flow.images) assert(captures[image.file].includes('/native-startup-pass-2026-10-19/'));
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'partial');
});
test('a functional case with rejected display images cannot be published as the reviewed startup tour', () => {
  assert.throws(() => validateRetainedNativeStartup(root,
    'docs/release/evidence/native-startup-display-review-2026-10-19/native-startup-results.json'));
});
