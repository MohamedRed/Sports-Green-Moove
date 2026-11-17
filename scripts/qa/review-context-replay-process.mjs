import assert from 'node:assert/strict';

export const reviewReplayPackage = 'be.sportgreenmoove.app.local';
export function latestMeminfo(row, snapshot) {
  assert.equal(row.command, 'dumpsys meminfo ' + reviewReplayPackage);
  assert.equal(row.source, 'provider-terminal-visible-accessibility-text');
  assert(snapshot.includes(row.visibleOutput), 'The selected visible output must belong to the original snapshot');
  const marker = snapshot.lastIndexOf(row.command);
  assert(marker >= 0, 'The observed terminal must include its exact command');
  const latest = snapshot.slice(marker + row.command.length);
  if (latest.includes('No process found for: ' + reviewReplayPackage)) {
    assert(!latest.includes('MEMINFO in pid')); return null;
  }
  const pids = [...latest.matchAll(/\*\* MEMINFO in pid ([1-9]\d*) \[be\.sportgreenmoove\.app\.local\] \*\*/g)];
  assert.equal(pids.length, 1, 'One current package-scoped process must be observed');
  assert.equal(row.pid, Number(pids[0][1])); return row.pid;
}
export function assertContextProcessRecovery(before, stopped, reopened, removed, runId, snapshots) {
  assert.deepEqual([before.phase, stopped.phase, reopened.phase], ['before', 'stopped', 'reopened']);
  for (const row of [before, stopped, reopened]) assert.equal(row.runId, runId);
  const oldPid = latestMeminfo(before, snapshots.before), newPid = latestMeminfo(reopened, snapshots.reopened);
  assert(oldPid && newPid); assert.notEqual(oldPid, newPid); assert.equal(latestMeminfo(stopped, snapshots.stopped), null);
  assert(Date.parse(before.observedAt) < Date.parse(stopped.observedAt));
  assert(Date.parse(stopped.observedAt) < Date.parse(reopened.observedAt));
  assert.equal(removed.command, 'dumpsys package ' + reviewReplayPackage);
  assert.equal(removed.source, 'provider-terminal-visible-accessibility-text');
  assert.match(removed.visibleOutput, /^\s*\d+ text Unable to find package: be\.sportgreenmoove\.app\.local$/);
  assert(Date.parse(reopened.observedAt) < Date.parse(removed.observedAt));
  return {beforePid: oldPid, reopenedPid: newPid};
}
