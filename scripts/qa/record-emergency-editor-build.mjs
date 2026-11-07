import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const [logPath, destination] = process.argv.slice(2);
assert(logPath && destination, 'Supply the completed Gradle log and a fresh output directory');
const root = resolve(import.meta.dirname, '../..'), output = resolve(destination);
assert(!existsSync(output), 'Preserve existing evidence; choose a fresh destination');
const log = readFileSync(logPath, 'utf8');
assert.match(log, /BUILD SUCCESSFUL/); assert.doesNotMatch(log, /BUILD FAILED/);
assert.match(log, /:app:assembleDebugAndroidTest/);
const parser = new XMLParser({ ignoreAttributes: false });
const xmlFiles = ['be.sportgreenmoove.app.ui.EmergencyContactStateTest', 'be.sportgreenmoove.app.services.EmergencyContactWireTest'];
const suites = xmlFiles.map((name) => {
  const path = resolve(root, `android/app/build/test-results/testDebugUnitTest/TEST-${name}.xml`);
  const xml = readFileSync(path), suite = parser.parse(xml).testsuite;
  assert.equal(Number(suite['@_failures']), 0); assert.equal(Number(suite['@_errors']), 0); assert.equal(Number(suite['@_skipped']), 0);
  return { name, xml, count: Number(suite['@_tests']), testedAt: suite['@_timestamp'] };
});
assert.equal(suites.reduce((count, suite) => count + suite.count, 0), 23);
const base = 'android/app/src/main/java/be/sportgreenmoove/app/';
const paths = ['data/EmergencyContactModels.kt', 'services/EmergencyContactGateway.kt', 'services/EmergencyContactWire.kt',
  'services/FirebaseAndroidEmergencyContactGateway.kt', 'services/AndroidEmergencyDialer.kt', 'services/FirebaseAndroidRuntime.kt',
  'ui/EmergencyContactState.kt', 'ui/EmergencyContactScreen.kt', 'ui/EmergencyContactDialogs.kt', 'ui/EmergencyContactRoute.kt',
  'ui/OptionsScreen.kt', 'ui/RideMonitorScreen.kt', 'ui/AppDestinations.kt', 'ui/SportsGreenMooveApp.kt'].map((path) => base + path);
paths.push('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/EmergencyContactFlowTest.kt');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
mkdirSync(output, { recursive: true });
for (const suite of suites) copyFileSync(resolve(root, `android/app/build/test-results/testDebugUnitTest/TEST-${suite.name}.xml`),
  resolve(output, `TEST-${suite.name}.xml`));
const report = { scope: 'android-local-unit-and-apk-build-not-native-execution', buildReportedAt: statSync(logPath).mtime.toISOString(),
  unitCaseCount: 23, unitSuites: suites.map(({ name, count, testedAt }) => ({ name, count, testedAt })),
  nativeTestApkCompiled: true, nativeComponentCasesCompiled: 6, nativeUiExecuted: false, dialerOpened: false,
  physicalDevice: false, productionWrites: false, serviceImplementationDeployed: false,
  sourceFiles: Object.fromEntries(paths.map((path) => [path, sha(readFileSync(resolve(root, path)))])),
  artifacts: Object.fromEntries(suites.map((suite) => [`TEST-${suite.name}.xml`, sha(suite.xml)])) };
writeFileSync(resolve(output, 'build-checks.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ unitCases: report.unitCaseCount, nativeCasesCompiled: report.nativeComponentCasesCompiled,
  nativeUiExecuted: false, output }));
