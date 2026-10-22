import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser } from 'fast-xml-parser';
import { parseAndroidJUnitTranscript, androidJUnitXml } from '../scripts/qa/android-junit-transcript.mjs';

const guard = 'INSTRUMENTATION_STATUS: sgm_installations_blocked=true\nINSTRUMENTATION_STATUS_CODE: 0\n';
const status = (current, total, code, name = 'case' + current) =>
  `INSTRUMENTATION_STATUS: class=be.sportgreenmoove.app.ui.ExampleTest\nINSTRUMENTATION_STATUS: test=${name}\n` +
  `INSTRUMENTATION_STATUS: current=${current}\nINSTRUMENTATION_STATUS: numtests=${total}\nINSTRUMENTATION_STATUS_CODE: ${code}\n`;
const completed = () => guard + status(1, 3, 1) + status(1, 3, 0) + status(2, 3, 1) + status(2, 3, -4) +
  status(3, 3, 1) + status(3, 3, -3) + 'INSTRUMENTATION_RESULT: stream=\nOK (2 tests)\nINSTRUMENTATION_CODE: -1\n';

test('complete raw SDK output retains passes, assumptions and ignored cases without dropping inventory', () => {
  const report = parseAndroidJUnitTranscript(completed());
  assert.equal(report.caseCount, 3); assert.equal(report.passed, 1); assert.equal(report.skipped, 2); assert.equal(report.failed, 0);
  const xml = new XMLParser({ ignoreAttributes: false }).parse(androidJUnitXml(report));
  assert.equal(xml.testsuite['@_tests'], '3'); assert.equal(xml.testsuite['@_skipped'], '2');
  assert.equal(xml.testsuite.testcase.length, 3);
});
test('actual failed cases remain failed even though adb and the instrumentation process finish successfully', () => {
  const input = guard + status(1, 1, 1) + status(1, 1, -2) + 'FAILURES!!!\nINSTRUMENTATION_CODE: -1\n';
  const report = parseAndroidJUnitTranscript(input); assert.equal(report.complete, true); assert.equal(report.failed, 1);
  const xml = new XMLParser().parse(androidJUnitXml(report)); assert(Object.hasOwn(xml.testsuite.testcase, 'failure'));
});
for (const [name, mutate] of [
  ['lost guard', text => text.replace(guard, '')], ['false guard', text => text.replace('blocked=true', 'blocked=false')],
  ['missing first start', text => text.replace(status(1, 3, 1), '')],
  ['missing final case', text => text.replace(status(3, 3, 1) + status(3, 3, -3), '')],
  ['changed inventory', text => text.replace('numtests=3', 'numtests=4')],
  ['repeated terminal case', text => text.replace(status(1, 3, 0), status(1, 3, 0).repeat(2))],
  ['wrong terminal identity', text => text.replace(status(1, 3, 0), status(1, 3, 0, 'otherCase'))],
  ['unknown code', text => text.replace('STATUS_CODE: -4', 'STATUS_CODE: -99')],
  ['lost runner result', text => text.replace('INSTRUMENTATION_CODE: -1', '')],
  ['cancelled runner', text => text.replace('INSTRUMENTATION_CODE: -1', 'INSTRUMENTATION_CODE: 0')],
  ['early runner end', text => 'INSTRUMENTATION_CODE: -1\n' + text.replace('INSTRUMENTATION_CODE: -1', '')],
  ['duplicate test identity', text => text.replaceAll('test=case2', 'test=case1')],
  ['wrong summary count', text => text.replace('OK (2 tests)', 'OK (1 test)')],
  ['process crash', text => text + '\nINSTRUMENTATION_RESULT: shortMsg=Process crashed'],
]) test('rejects ' + name + ' rather than accepting a partial matrix', () => {
  assert.throws(() => parseAndroidJUnitTranscript(mutate(completed())));
});
