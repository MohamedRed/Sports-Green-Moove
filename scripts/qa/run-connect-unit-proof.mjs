import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const root = resolve(import.meta.dirname, '../..'), base = resolve(root, 'docs/release/evidence/driver-connect-2026-10-24');
const out = resolve(base, 'units'); assert(!existsSync(out)); mkdirSync(out);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = ['services/StripeConnectCoordinator.kt', 'services/RidePaymentCoordinator.kt',
  'ui/PaymentsRoute.kt', 'ui/PaymentsConnectCard.kt', 'ui/PaymentsScreen.kt', 'ui/V2Components.kt', 'ui/SportsGreenMooveApp.kt']
  .map(path => 'android/app/src/main/java/be/sportgreenmoove/app/' + path);
paths.push('android/app/src/test/java/be/sportgreenmoove/app/services/StripeConnectCoordinatorTest.kt');
const sourceFiles = Object.fromEntries(paths.map(file => [file, sha(readFileSync(resolve(root, file)))]));
for (const [file, hash] of Object.entries(sourceFiles)) {
  const path = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(path)) writeFileSync(path, readFileSync(resolve(root, file)), {flag: 'wx'});
}
const args = [':app:testDebugUnitTest', '-PSGM_USE_FIREBASE_EMULATOR=true', '-PSGM_FIREBASE_EMULATOR_HOST=10.0.2.2',
  '--no-daemon', '--rerun-tasks', '--max-workers=2', '--console=plain'];
const result = spawnSync('./gradlew', args, {cwd: resolve(root, 'android'), env: process.env,
  encoding: 'utf8', timeout: 600_000, maxBuffer: 16 * 1024 * 1024});
const redact = value => String(value ?? '').replace(/AIza[\w-]{20,}|Bearer\s+[\w.~+/-]+=*|eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[REDACTED]');
writeFileSync(resolve(out, 'gradle.txt'), redact(result.stdout) + redact(result.stderr), {flag: 'wx'});
const report = {scope: 'restored-android-local-unit-execution-not-device-or-provider-proof', command: ['./gradlew', ...args],
  verifiedAt: new Date().toISOString(), exitCode: result.status, signal: result.signal, completed: false, sourceFiles,
  productionWrites: false, providerRequests: 0};
try {
  assert.equal(result.status, 0); assert.equal(result.signal, null); assert(!result.error);
  const results = resolve(root, 'android/app/build/test-results/testDebugUnitTest');
  const counts = {tests: 0, failures: 0, errors: 0, skipped: 0};
  const parser = new XMLParser({ignoreAttributes: false});
  for (const file of readdirSync(results).filter(file => file.endsWith('.xml'))) {
    const suite = parser.parse(readFileSync(resolve(results, file))).testsuite;
    for (const key of Object.keys(counts)) counts[key] += Number(suite['@_' + key]);
  }
  assert.equal(counts.tests, 543);
  for (const key of ['failures', 'errors', 'skipped']) assert.equal(counts[key], 0);
  const full = resolve(out, 'full-suite'); mkdirSync(full);
  for (const file of readdirSync(results).filter(file => file.endsWith('.xml'))) copyFileSync(resolve(results, file), resolve(full, file));
  for (const name of ['StripeConnectCoordinatorTest', 'RidePaymentCoordinatorTest']) {
    const file = `TEST-be.sportgreenmoove.app.services.${name}.xml`;
    copyFileSync(resolve(results, file), resolve(out, file));
  }
  for (const [file, hash] of Object.entries(sourceFiles)) assert.equal(sha(readFileSync(resolve(root, file))), hash);
  Object.assign(report, {completed: true, counts});
} finally {writeFileSync(resolve(out, 'run.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});}
assert.equal(report.completed, true);
console.log('543 restored-source unit cases passed; original four-case device evidence remains separately dated.');
