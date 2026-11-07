import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {compressionSecurityFolder, validateCompressionSecurity} from '../scripts/qa/compression-security-evidence.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
test('actual aborted responses, compatible patch and isolated compatibility results stay bounded', () => {
  assert.deepEqual(validateCompressionSecurity(root), {findingsRemaining: 38, localCompressionCasesPassed: 7, releaseAccepted: false});
  assert(content.updates.some(row => row.source === compressionSecurityFolder + 'README.md'));
  assert.equal(content.blockers.find(row => row.id === 'dependency-security').latestSource, compressionSecurityFolder + 'README.md');
});
for (const key of ['productionRuntimeChanged', 'productionDeployed', 'physicalDeviceAccepted', 'providerDeliveryAccepted',
  'fullNativeGateAccepted', 'nativeInstabilityFixed', 'releaseAccepted', 'cleanAudit'])
  test('recomputed checksums cannot promote compression proof to ' + key, t => {
    const temp = mkdtempSync(resolve(tmpdir(), 'sgm-compression-evidence-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
    const folder = resolve(temp, compressionSecurityFolder); cpSync(resolve(root, compressionSecurityFolder), folder, {recursive: true});
    validateCompressionSecurity(temp);
    const summary = JSON.parse(readFileSync(resolve(folder, 'summary.json'))); summary[key] = true;
    const bytes = JSON.stringify(summary); writeFileSync(resolve(folder, 'summary.json'), bytes);
    const hashes = JSON.parse(readFileSync(resolve(folder, 'artifact-sha256.json'))); hashes['summary.json'] = createHash('sha256').update(bytes).digest('hex');
    const original = JSON.parse(readFileSync(resolve(folder, 'compatibility/original-manifest.json')));
    original['summary.json'] = hashes['summary.json'];
    const originalBytes = JSON.stringify(original); writeFileSync(resolve(folder, 'compatibility/original-manifest.json'), originalBytes);
    hashes['compatibility/original-manifest.json'] = createHash('sha256').update(originalBytes).digest('hex');
    writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify(hashes));
    assert.throws(() => validateCompressionSecurity(temp), new RegExp(key));
  });
test('the installed CLI resolves the maintained compatible compression package without an override', () => {
  const require = createRequire(import.meta.url), cli = createRequire(require.resolve('firebase-tools/package.json'));
  const hosting = createRequire(cli.resolve('superstatic/package.json')), installed = hosting('compression/package.json');
  const lock = require('../package-lock.json'); assert.equal(installed.version, lock.packages['node_modules/compression'].version);
  assert(require('semver').satisfies(installed.version, '>=1.8.2 <2'));
  assert(require('semver').satisfies(installed.version, hosting('superstatic/package.json').dependencies.compression));
  assert.equal(require('../package.json').overrides, undefined); assert.equal(lock.packages['node_modules/compression'].dev, true);
});
test('the later passing notification trial cannot erase or repair its original timeout', t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-compression-recheck-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  const folder = resolve(temp, compressionSecurityFolder); cpSync(resolve(root, compressionSecurityFolder), folder, {recursive: true});
  const file = 'compatibility/notification-recheck-context.json', context = JSON.parse(readFileSync(resolve(folder, file)));
  context.originalTimeoutFixed = true;
  const bytes = JSON.stringify(context); writeFileSync(resolve(folder, file), bytes);
  const hashes = JSON.parse(readFileSync(resolve(folder, 'artifact-sha256.json'))); hashes[file] = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify(hashes));
  assert.throws(() => validateCompressionSecurity(temp), /originalTimeoutFixed/);
});
test('both mandatory gates run the real-response regressions and retained-scope assertions', () => {
  for (const name of ['native-ci', 'web-integration-smoke']) {
    const workflow = parseDocument(readFileSync(resolve(root, '.github/workflows', name + '.yml'), 'utf8')).toJSON();
    const steps = Object.values(workflow.jobs).flatMap(job => job.steps ?? []).filter(step => step.name === 'Test premature response compression cleanup');
    assert.equal(steps.length, 1); assert.equal(steps[0].run,
      'node --test tests/compression-close-security.test.mjs tests/compression-close-security-evidence.test.mjs');
    assert.equal(steps[0].if, undefined); assert.equal(steps[0]['continue-on-error'], undefined);
    for (const event of ['push', 'pull_request']) for (const path of ['tests/compression-close-security*.test.mjs', 'tests/helpers/compression-close-probe.mjs'])
      assert(workflow.on[event].paths.includes(path));
  }
});
