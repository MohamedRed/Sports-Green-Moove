import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const output = '/Users/mrr/.codex/sgm-native-comparison-20261030/search-departure-trial';
const save = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const build = '/private/tmp/sgm-search-departure-build-layout-20261030.txt';
assert(readFileSync(build, 'utf8').includes('BUILD SUCCESSFUL'));
copyFileSync(build, resolve(output, 'after/build.txt'));
copyFileSync('/private/tmp/sgm-search-departure-build-final-20261030.txt', resolve(output, 'preparation/helper-corrected-build.txt'));
copyFileSync(resolve(root, 'android/app/build/test-results/testDebugUnitTest/TEST-be.sportgreenmoove.app.ui.SearchDepartureInputTest.xml'),
  resolve(output, 'after/SearchDepartureInputTest.xml'));
const paths = [
  ...['SearchScreen.kt', 'SearchDepartureField.kt', 'SearchDepartureInput.kt', 'SearchController.kt', 'SearchFormState.kt', 'SgmTestTags.kt']
    .map(name => 'android/app/src/main/java/be/sportgreenmoove/app/ui/' + name),
  ...['TripChangeInput.kt', 'TripDateLabels.kt'].map(name => 'android/app/src/main/java/be/sportgreenmoove/app/domain/' + name),
  'android/app/src/test/java/be/sportgreenmoove/app/ui/SearchDepartureInputTest.kt',
  ...['SearchDepartureFlowTest.kt', 'SearchDepartureLayoutTest.kt', 'SearchDeparturePickerInput.kt', 'SearchCriteriaFlowTest.kt',
    'LocalParentSearchBookingTest.kt', 'NativeDatePickerInput.kt', 'NativeTimePickerInput.kt']
    .map(name => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + name),
];
save('after/source-sha256.json', Object.fromEntries(paths.map(path => {
  const bytes = readFileSync(resolve(root, path));
  const sha = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(resolve(output, 'after', sha + '.txt'), bytes, {flag: 'wx'}); return [path, sha];
})));
const metadata = JSON.parse(readFileSync(resolve(root, 'android/app/build/outputs/apk/debug/output-metadata.json')));
assert.equal(metadata.applicationId, 'be.sportgreenmoove.app.local');
const filename = 'sgm-search-departure-20261030.apk';
copyFileSync(resolve(root, 'android/app/build/outputs/apk/debug/app-debug.apk'), resolve(output, filename));
save('after/apk.json', {filename, packageId: metadata.applicationId,
  sha256: createHash('sha256').update(readFileSync(resolve(output, filename))).digest('hex'),
  sourceHead: 'ea648f67a2fd42f3f3f38c8a8abedc5971a0d548', cleanCheckoutAttested: false,
  workingTreeSourcesRetained: true, installedBytesIndependentlyVerified: false,
  nativeUiCasesBuilt: 9, nativeUiCasesExecutedLocally: false, nativeUiCasesExecutedOnPhysicalPhone: false});
console.log(JSON.stringify({filename, packageId: metadata.applicationId, sourceFiles: paths.length}));
