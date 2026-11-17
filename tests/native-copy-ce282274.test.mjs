import assert from 'node:assert/strict';
import test from 'node:test';
import { content } from '../partner-portal/content.mjs';
import { validateNativeCopyCe282274 } from '../scripts/qa/native-copy-ce282274-evidence.mjs';
const root = process.cwd();
test('newer passing login cases do not erase the failed primary copy or promote the whole replay', () => {
  const report = validateNativeCopyCe282274(root, content.latestNativeCopyRecheck, content.blockers);
  assert.equal(report.guardianCasePassed, true); assert.equal(report.teamCasePassed, true);
  assert.equal(report.fullCiPassed, false); assert.equal(report.copyRootCauseConfirmed, false);
});
test('the newer copy blocker is required instead of a stale login blocker', () => {
  assert.throws(() => validateNativeCopyCe282274(root, content.latestNativeCopyRecheck, []));
  assert.throws(() => validateNativeCopyCe282274(root, content.latestNativeCopyRecheck,
    [...content.blockers, {id: 'native-login-replay'}]));
});
