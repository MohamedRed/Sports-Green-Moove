import assert from 'node:assert/strict';

const events = new Set(['Opened', 'Connected', 'ConnectionFailed', 'LocationChanged', 'LocationFailed',
  'RideCached', 'RideServer', 'RideFailed', 'FetchStarted', 'FetchCompleted', 'FetchCancelled', 'FetchFailed', 'Closed']);
export function parseRideObservationTrace(views) {
  const rows = new Map();
  for (const view of views) for (const line of view.split('\n').filter(line => line.trim())) {
    const match = /\brow (\d{2}-\d{2} [\d:.]+) I\/SGM\.RideObservation\((\d+)\): observer=(\d+) sequence=(\d+) elapsedMs=(\d+) event=(\w+)(?: connected=(true|false))?$/.exec(line);
    assert(match, 'Only complete, enum-only diagnostic rows are accepted');
    const [, time, pid, observer, sequence, elapsed, event, connected] = match;
    assert(events.has(event)); assert.equal(connected !== undefined, event === 'Connected');
    const row = {time, pid: Number(pid), observer: Number(observer), sequence: Number(sequence),
      elapsedMs: Number(elapsed), event, ...(connected === undefined ? {} : {connected: connected === 'true'})};
    const key = `${observer}:${sequence}`;
    if (rows.has(key)) assert.deepEqual(rows.get(key), row, 'Overlapping original views must agree');
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.observer - b.observer || a.sequence - b.sequence);
}

export function verifyDisconnectedRideTrace(rows) {
  assert.deepEqual([...new Set(rows.map(row => row.observer))], [1, 2]);
  assert.equal(new Set(rows.map(row => row.pid)).size, 1);
  let completedRefreshes = 0;
  const listenerLifetimesMs = [];
  for (const observer of [1, 2]) {
    const own = rows.filter(row => row.observer === observer);
    assert.equal(own[0].event, 'Opened'); assert.equal(own.at(-1).event, 'Closed');
    assert.deepEqual(own.map(row => row.sequence), Array.from({length: own.length}, (_, index) => index + 1));
    let started;
    for (const [index, row] of own.entries()) {
      if (index) assert(row.elapsedMs >= own[index - 1].elapsedMs);
      if (row.event === 'FetchStarted') {assert.equal(started, undefined); started = row.elapsedMs;}
      if (row.event === 'FetchCompleted') {
        assert(started !== undefined); assert(row.elapsedMs - started < 1_000); started = undefined; completedRefreshes++;
      }
    }
    assert.equal(started, undefined);
    assert.deepEqual(own.filter(row => row.event === 'Connected').map(row => row.connected), [false]);
    assert(!own.some(row => /Failed|Cancelled|LocationChanged/.test(row.event)));
    listenerLifetimesMs.push(own.at(-1).elapsedMs);
  }
  return {completedRefreshes, listenerLifetimesMs, databaseConnectionEstablished: false, locationInvalidationsObserved: 0};
}
