import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { content, captures } from '../partner-portal/content.mjs';
import { validateRetainedRemoteRideStop } from '../scripts/qa/remote-ride-stop-evidence.mjs';
test('remote completion publishes only its reviewed start image and preserves the actual local scope', () => {
  const flow = content.flows.find((row) => row.id === 'remote-ride-stop');
  const report = validateRetainedRemoteRideStop(fileURLToPath(new URL('../', import.meta.url)), flow.ui.source);
  assert.equal(report.backgroundStopBeforeResume, true); assert.equal(report.physicalBackgroundGpsVerified, false);
  assert.equal(flow.status, 'partial'); assert.equal(flow.phone, undefined); assert.equal(flow.tour, undefined);
  assert.deepEqual(flow.images.map((image) => image.file), ['remote-ride-stop-started']);
  assert.match(captures['remote-ride-stop-started'], /remote-ride-stop-pass-2026-10-19/);
  assert.equal(captures['remote-ride-stop-ended'], undefined);
  assert.match(flow.remaining, /navigation du bas/); assert.match(flow.remaining, /Pas encore en ligne/);
  assert.equal(content.flows.find((row) => row.id === 'tracking').status, 'partial');
});
