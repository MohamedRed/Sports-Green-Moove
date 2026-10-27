import assert from 'node:assert/strict';

export const captureDiagnosticScope = 'primary-compose-capture-observation-not-flow-or-root-cause-proof';
export const requiredTripCaptureNames = ['trip-change-driver-proposed.png', 'trip-change-parent-review-large-text.png',
  'trip-change-parent-accepted.png', 'trip-change-close-pinned-large-text.png', 'trip-change-parent-declined.png',
  'trip-change-applied-balance-due.png'];
const keys = (object, names) => assert.deepEqual(Object.keys(object).sort(), names.slice().sort());
const number = value => assert(Number.isSafeInteger(value) && value >= 0 && value <= 300_000);
const bool = value => assert.equal(typeof value, 'boolean');
const label = value => assert(typeof value === 'string' && value.length <= 260 && !/[\u0000-\u001f\u007f@/:]/u.test(value));
function frames(rows) {
  assert(Array.isArray(rows) && rows.length <= 20);
  for (const row of rows) {
    keys(row, ['className', 'methodName', 'fileName', 'lineNumber']);
    for (const key of ['className', 'methodName', 'fileName']) label(row[key]);
    assert(Number.isSafeInteger(row.lineNumber) && row.lineNumber >= -2 && row.lineNumber <= 2_147_483_647);
  }
}

export function validatePrimaryCaptureDiagnostic(value) {
  assert([1, 2].includes(value.schemaVersion));
  keys(value, ['schemaVersion', 'scope', 'captureName', 'sdkInvocations', 'primaryOutcome', 'errorCategory', 'elapsedMs',
    'callerIsMain', 'mainPostAccepted', 'heartbeatDelaysMs', 'maxMainQueueDelayMs', 'samples', 'sampleFailures',
    'observerClosed', 'observerMayAffectScheduling', 'imagesWrittenByObserver', 'primaryStartOffsetMs', 'primaryElapsedMs', 'heartbeatAtMs',
    ...(value.schemaVersion === 2 ? ['observerTerminationVerified'] : [])]);
  assert.equal(value.scope, captureDiagnosticScope);
  assert(requiredTripCaptureNames.includes(value.captureName));
  assert(['prepared', 'returned', 'threw'].includes(value.primaryOutcome));
  assert.equal(value.sdkInvocations, value.primaryOutcome === 'prepared' ? 0 : 1);
  assert(value.primaryOutcome === 'threw' ? ['pixelcopy-callback-wait', 'other'].includes(value.errorCategory) : value.errorCategory === 'none');
  number(value.elapsedMs); bool(value.callerIsMain); bool(value.mainPostAccepted); bool(value.observerClosed);
  if (value.schemaVersion === 2) {
    if (value.observerClosed) bool(value.observerTerminationVerified);
    else assert.equal(value.observerTerminationVerified, null);
  }
  if (value.primaryOutcome === 'prepared') {
    assert.equal(value.primaryStartOffsetMs, null); assert.equal(value.primaryElapsedMs, null);
  } else {
    number(value.primaryStartOffsetMs); number(value.primaryElapsedMs);
    assert([0, 1].includes(value.elapsedMs - value.primaryStartOffsetMs - value.primaryElapsedMs));
  }
  assert.equal(value.observerMayAffectScheduling, true); assert.equal(value.imagesWrittenByObserver, false);
  assert(Array.isArray(value.heartbeatDelaysMs) && value.heartbeatDelaysMs.length <= 64);
  value.heartbeatDelaysMs.forEach(number);
  assert(Array.isArray(value.heartbeatAtMs) && value.heartbeatAtMs.length === value.heartbeatDelaysMs.length);
  value.heartbeatAtMs.forEach((at, index, rows) => { number(at); if (index) assert(at >= rows[index - 1]); });
  assert.equal(value.maxMainQueueDelayMs, value.heartbeatDelaysMs.length ? Math.max(...value.heartbeatDelaysMs) : null);
  assert(Array.isArray(value.samples) && value.samples.length <= 3);
  const scheduled = new Set();
  for (const sample of value.samples) {
    keys(sample, ['atMs', 'scheduledMs', 'offsetMs', 'observerDelayMs', 'mainState', 'mainFrames', 'callerFrames']);
    number(sample.atMs); number(sample.observerDelayMs);
    assert([250, 600, 900].includes(sample.offsetMs) && !scheduled.has(sample.offsetMs)); scheduled.add(sample.offsetMs);
    number(sample.scheduledMs); assert(sample.scheduledMs >= sample.offsetMs);
    assert.equal(sample.observerDelayMs, Math.max(0, sample.atMs - sample.scheduledMs));
    assert(['NEW', 'RUNNABLE', 'BLOCKED', 'WAITING', 'TIMED_WAITING', 'TERMINATED'].includes(sample.mainState));
    frames(sample.mainFrames); frames(sample.callerFrames);
  }
  assert(Number.isInteger(value.sampleFailures) && value.sampleFailures >= 0 && value.sampleFailures <= 3);
  if (value.primaryOutcome === 'prepared') {
    assert.equal(value.observerClosed, false); assert.equal(value.elapsedMs, 0); assert.equal(value.mainPostAccepted, false);
    assert.deepEqual(value.heartbeatDelaysMs, []); assert.deepEqual(value.heartbeatAtMs, []);
    assert.deepEqual(value.samples, []); assert.equal(value.sampleFailures, 0);
  }
  return { complete: value.primaryOutcome !== 'prepared' && value.observerClosed && value.mainPostAccepted && value.sampleFailures === 0
    && (value.schemaVersion === 1 || value.observerTerminationVerified === true) };
}
