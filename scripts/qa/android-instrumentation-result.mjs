import assert from 'node:assert/strict';

export function assertInstrumentationPassed(output, expected) {
  assert(!/FAILURES|Process crashed|INSTRUMENTATION_FAILED/.test(output), 'Local Android instrumentation failed');
  assert(output.includes(`OK (${expected} test${expected === 1 ? '' : 's'})`), 'A completed Android test run is required');
}
