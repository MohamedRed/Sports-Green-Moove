import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const output = '/Users/mrr/.codex/sgm-native-comparison-20261030/search-departure-trial';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.deepEqual(process.argv.slice(2), []); assert(!existsSync(output));
mkdirSync(output, {mode: 0o700});
for (const name of ['before', 'after', 'preparation', 'captures']) mkdirSync(resolve(output, name), {mode: 0o700});
const baseHead = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
assert.equal(baseHead, 'ea648f67a2fd42f3f3f38c8a8abedc5971a0d548');
const sources = ['android/app/src/main/java/be/sportgreenmoove/app/ui/SearchScreen.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/SearchFormState.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/SearchCriteriaFlowTest.kt'];
const sourceFiles = Object.fromEntries(sources.map(path => {
  const bytes = execFileSync('git', ['show', baseHead + ':' + path], {cwd: root});
  writeFileSync(resolve(output, 'before', path.split('/').at(-1) + '.txt'), bytes, {flag: 'wx'});
  return [path, sha(bytes)];
}));
copyFileSync('/private/tmp/sgm-search-departure-build-20261030.txt', resolve(output, 'preparation/initial-build.txt'));
copyFileSync(resolve(root, 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/SearchDeparturePickerInput.kt'),
  resolve(output, 'preparation/initial-picker-helper.kt.txt'));
writeFileSync(resolve(output, 'before/source-sha256.json'), JSON.stringify(sourceFiles, null, 2) + '\n', {flag: 'wx'});
writeFileSync(resolve(output, 'before/review.json'), JSON.stringify({baseHead, observedAt: new Date().toISOString(),
  previousSearchCapture: 'docs/release/evidence/accent-controls-phone-2026-10-30/captures/search-light.png',
  previousCaptureSha256: sha(readFileSync(resolve(root, 'docs/release/evidence/accent-controls-phone-2026-10-30/captures/search-light.png'))),
  beforeNativePickerRegressionExecuted: false, initialBuildFailure: 'test-helper-rule-type-mismatch-not-product-failure'}, null, 2) + '\n', {flag: 'wx'});
console.log('Original raw-date source, earlier capture identity and initial compile failure retained privately.');
