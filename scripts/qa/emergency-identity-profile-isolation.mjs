import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';

export function assertEmergencyIdentityProfiles(before, after) {
  assert.deepEqual(after.map((row) => row.id), before.map((row) => row.id));
  for (const [index, row] of after.entries()) {
    const original = before[index];
    if (row.id !== 'sgm-qa-parent') { assert.deepEqual(row, original); continue; }
    const { updatedAt: previous, ...oldFields } = original.data;
    const { updatedAt: current, ...newFields } = row.data;
    assert(previous instanceof Timestamp && current instanceof Timestamp);
    assert(current.seconds > previous.seconds || current.seconds === previous.seconds && current.nanoseconds >= previous.nanoseconds);
    assert.deepEqual(newFields, oldFields);
  }
}
