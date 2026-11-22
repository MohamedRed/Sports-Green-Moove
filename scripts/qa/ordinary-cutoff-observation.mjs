import assert from 'node:assert/strict';
import {androidJUnitIdentifier} from './android-junit-transcript.mjs';

export function observeIncompleteOrdinaryTranscript(text) {
  assert(typeof text === 'string' && Buffer.byteLength(text) <= 16 * 1024 * 1024);
  assert(!/^INSTRUMENTATION_CODE:/m.test(text), 'This observation cannot replace a completed runner result');
  let packet = {}, guarded = false, announced;
  const cases = [];
  for (const line of text.split(/\r?\n/)) {
    let match = /^INSTRUMENTATION_STATUS: (class|test|current|numtests|sgm_installations_blocked)=(.*)$/.exec(line);
    if (match) { assert(!Object.hasOwn(packet, match[1])); packet[match[1]] = match[2]; continue; }
    match = /^INSTRUMENTATION_STATUS_CODE: (-?\d+)$/.exec(line); if (!match) continue;
    const code = Number(match[1]);
    if (Object.hasOwn(packet, 'sgm_installations_blocked')) {
      assert(!guarded && cases.length === 0); assert.equal(packet.sgm_installations_blocked, 'true');
      assert.equal(code, 0); assert.deepEqual(Object.keys(packet), ['sgm_installations_blocked']);
      guarded = true; packet = {}; continue;
    }
    assert(guarded); assert.match(packet.class ?? '', androidJUnitIdentifier);
    assert.match(packet.test ?? '', androidJUnitIdentifier);
    for (const key of ['current', 'numtests']) assert.match(packet[key] ?? '', /^[1-9]\d{0,5}$/);
    const current = Number(packet.current), total = Number(packet.numtests);
    announced ??= total; assert.equal(total, announced); assert(current <= total);
    if (code === 1) {
      assert.equal(current, cases.length + 1); assert(cases.every(row => row.status !== 'started'));
      assert(!cases.some(row => row.className === packet.class && row.name === packet.test));
      cases.push({className: packet.class, name: packet.test, current, status: 'started'});
    } else {
      assert([0, -1, -2, -3, -4].includes(code));
      const row = cases[current - 1]; assert(row && row.status === 'started');
      assert.equal(row.className, packet.class); assert.equal(row.name, packet.test);
      row.status = code === 0 ? 'ended-with-zero' : code === -3 || code === -4 ? 'skipped' : 'ended-with-failure';
    }
    packet = {};
  }
  assert(guarded && announced > 0 && cases.length > 0); assert.deepEqual(packet, {});
  return {scope: 'partial-ordinary-transcript-observation-not-complete-test-or-cause-proof',
    announcedCases: announced, startedCases: cases.length, endedCases: cases.filter(row => row.status !== 'started').length,
    endedWithZero: cases.filter(row => row.status === 'ended-with-zero').length,
    skipped: cases.filter(row => row.status === 'skipped').length,
    endedWithFailure: cases.filter(row => row.status === 'ended-with-failure').length,
    lastObserved: cases.at(-1), completeRunnerResultObserved: false, lastCaseHangProven: false, flowAccepted: false};
}
