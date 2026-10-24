import assert from 'node:assert/strict';
import { XMLBuilder } from 'fast-xml-parser';

const identifier = /^[A-Za-z_$][A-Za-z0-9_.$]*(?:\[[A-Za-z0-9_ .:-]{1,100}\])?$/;
const integer = value => { assert(/^[1-9]\d{0,5}$/.test(value)); return Number(value); };

export function parseAndroidJUnitTranscript(output) {
  assert.equal(typeof output, 'string'); assert(output.length <= 16 * 1024 * 1024);
  assert(!/INSTRUMENTATION_FAILED|Process crashed|shortMsg=/.test(output), 'Instrumentation did not complete normally');
  const cases = [], terminalCodes = []; let packet = {}, guardConfirmed = false, announced;
  for (const line of output.split(/\r?\n/)) {
    let match = /^INSTRUMENTATION_STATUS: ([A-Za-z_]+)=(.*)$/.exec(line);
    if (match) {
      assert.equal(terminalCodes.length, 0, 'Test fields cannot follow the final runner result');
      const [, key, value] = match;
      if (['class', 'test', 'numtests', 'current', 'sgm_installations_blocked'].includes(key)) {
        assert(!Object.hasOwn(packet, key), 'Duplicate instrumentation field'); packet[key] = value;
      }
      continue;
    }
    match = /^INSTRUMENTATION_CODE: (-?\d+)$/.exec(line);
    if (match) { terminalCodes.push(Number(match[1])); continue; }
    match = /^INSTRUMENTATION_STATUS_CODE: (-?\d+)$/.exec(line); if (!match) continue;
    assert.equal(terminalCodes.length, 0, 'A test cannot follow the final runner result');
    const code = Number(match[1]);
    if (Object.hasOwn(packet, 'sgm_installations_blocked')) {
      assert.equal(packet.sgm_installations_blocked, 'true'); assert.equal(code, 0);
      assert.equal(guardConfirmed, false); assert.equal(cases.length, 0);
      assert.deepEqual(Object.keys(packet), ['sgm_installations_blocked']); guardConfirmed = true; packet = {}; continue;
    }
    assert(guardConfirmed, 'The installation guard must be confirmed before any test');
    assert.match(packet.class ?? '', identifier); assert.match(packet.test ?? '', identifier);
    const total = integer(packet.numtests), current = integer(packet.current);
    if (announced === undefined) announced = total; else assert.equal(total, announced, 'Test inventory changed');
    assert(current <= total); assert([1, 0, -1, -2, -3, -4].includes(code), 'Unknown test status');
    if (code === 1) {
      assert.equal(current, cases.length + 1); assert(cases.every(row => row.status !== 'started'));
      assert(!cases.some(row => row.className === packet.class && row.name === packet.test), 'Duplicate discovered test identity');
      cases.push({ className: packet.class, name: packet.test, status: 'started' });
    } else {
      const item = cases[current - 1]; assert(item && item.status === 'started', 'A terminal test needs its matching start');
      assert.equal(item.className, packet.class); assert.equal(item.name, packet.test);
      item.status = code === 0 ? 'passed' : code === -3 || code === -4 ? 'skipped' : 'failed';
      item.reason = code === -3 ? 'ignored' : code === -4 ? 'assumption' : code < 0 ? 'test-failure' : null;
    }
    packet = {};
  }
  assert.deepEqual(terminalCodes, [-1], 'One complete runner result is required');
  assert(guardConfirmed && announced > 0); assert.equal(cases.length, announced);
  assert(cases.every(row => row.status !== 'started')); assert.deepEqual(packet, {});
  const passed = cases.filter(row => row.status === 'passed').length;
  const skipped = cases.filter(row => row.status === 'skipped').length, failed = cases.length - passed - skipped;
  if (failed === 0) {
    const summaries = [...output.matchAll(/^OK \((\d+) tests?\)\s*$/gm)]; assert.equal(summaries.length, 1);
    assert.equal(Number(summaries[0][1]), cases.length - cases.filter(row => row.reason === 'ignored').length);
  }
  return { scope: 'complete-android-junit-instrumentation-not-physical-or-release-proof', complete: true,
    guardConfirmed, caseCount: cases.length, passed, skipped, failed, cases };
}

export function androidJUnitXml(report) {
  assert.equal(report.complete, true);
  return new XMLBuilder({ ignoreAttributes: false, format: true }).build({
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    testsuite: { '@_name': 'Android component matrix', '@_tests': report.caseCount, '@_failures': report.failed,
      '@_errors': 0, '@_skipped': report.skipped,
      testcase: report.cases.map(row => ({ '@_classname': row.className, '@_name': row.name,
        ...(row.status === 'skipped' ? { skipped: { '@_message': row.reason } } : {}),
        ...(row.status === 'failed' ? { failure: { '@_message': 'Android instrumentation reported a failed case' } } : {}) })) },
  });
}
