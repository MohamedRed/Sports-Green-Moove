import assert from 'node:assert/strict';

export const supportPhonePhases = ['prepared', 'invalid', 'submitted', 'reopened', 'reviewed'];
export const supportPhoneInput = Object.freeze({ reason: 'Support telephone QA',
  description: 'Demande isolee envoyee depuis le telephone de test.', subjectType: 'other', emergency: false });

export function verifySupportPhoneCheckpoint(phase, { reports, notifications }, fixture) {
  assert(supportPhonePhases.includes(phase));
  assert(Array.isArray(reports) && Array.isArray(notifications));
  assert.equal(notifications.length, 0, 'Do not claim a requester response from an unrelated notice');
  if (['prepared', 'invalid'].includes(phase)) {
    assert.equal(reports.length, 0, 'An invalid or untouched form must not create a report');
    return { phase, reportCount: 0, status: null, requesterResponseRecorded: false };
  }
  assert.equal(reports.length, 1, 'Exactly one phone-created report is required');
  const report = reports[0];
  assert.equal(report.reporterUserId, fixture.parentUid);
  for (const [key, value] of Object.entries(supportPhoneInput)) assert.equal(report[key], value, key);
  assert.equal(typeof report.id, 'string'); assert(report.id.length > 0);
  assert(!Object.hasOwn(report, 'subjectId'));
  assert(report.createdAt && report.updatedAt);
  if (fixture.reportId) assert.equal(report.id, fixture.reportId, 'Reopening cannot replace the original report');
  assert.equal(report.status, phase === 'reviewed' ? 'closed' : 'open');
  if (phase === 'reviewed') {
    assert.equal(report.reviewedByUserId, fixture.adminUid);
    assert.equal(report.reviewNote, 'Cloture du test isole.');
    assert(report.closedAt && report.reviewedAt);
    assert.deepEqual(report.reviewEvents.map(row => ({ status: row.status, reviewerUserId: row.reviewerUserId, note: row.note })), [
      { status: 'reviewing', reviewerUserId: fixture.adminUid, note: 'Prise en charge du test isole.' },
      { status: 'closed', reviewerUserId: fixture.adminUid, note: 'Cloture du test isole.' },
    ]);
  } else assert(!report.reviewEvents && !report.reviewedByUserId && !report.closedAt);
  return { phase, reportId: report.id, reportCount: 1, status: report.status, requesterResponseRecorded: false };
}
