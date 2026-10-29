import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSessionRestorationRecheck } from '../scripts/qa/session-restoration-recheck.mjs';
import { content } from '../partner-portal/content.mjs';
test('historical transport failure keeps its own date without promotion to an executed UI or production defect', () => {
  const flow = content.flows.find(item => item.id === 'session-restoration');
  const report = validateSessionRestorationRecheck(process.cwd(), flow.restorationRecheck.source);
  assert.equal(report.caseCompleted, false); assert.equal(report.appUiReached, false);
  assert.equal(flow.status, 'partial'); assert.equal(flow.restorationRecheck.checkedAt, '2026-10-21');
  assert.equal(flow.checkedAt, '2026-10-29');
  assert.equal(flow.ui.checkedAt, '2026-10-20');
  assert(flow.images.filter(image => image.file.startsWith('session-recovery-')).every(image => image.alt.includes('20 octobre')));
  assert.match(flow.remaining, /interruptions précédentes/); assert(flow.restorationRecovery);
});
