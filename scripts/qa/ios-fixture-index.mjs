import assert from 'node:assert/strict';

export function iosFixtureIndexName(job, outcome) {
  assert(['accepted', 'recheck'].includes(outcome));
  assert(Number.isSafeInteger(job.jobId) && job.jobId > 0);
  assert.match(job.completedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
  const completed = new Date(job.completedAt).toISOString();
  assert.equal(completed.slice(0, 19), job.completedAt.slice(0, 19));
  const stamp = completed.replace(/[:.]/g, '');
  return `automated-user-flow-evidence-${stamp}-${job.jobId}-${outcome}.json`;
}
