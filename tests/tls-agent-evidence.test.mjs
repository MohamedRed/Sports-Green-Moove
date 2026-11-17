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
import {tlsAgentSecurityFolder, validateTlsAgentSecurity} from '../scripts/qa/tls-agent-security-evidence.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
test('retained TLS failure, corrected requests and all compatibility results preserve their scope', () => {
  assert.deepEqual(validateTlsAgentSecurity(root), {findingsRemaining: 29, localTlsCasesPassed: 3, releaseAccepted: false});
  assert(content.updates.some(row => row.source === tlsAgentSecurityFolder + 'README.md'));
  assert.notEqual(content.blockers.find(row => row.id === 'dependency-security').latestSource, tlsAgentSecurityFolder + 'README.md');
});
for (const key of ['productionRuntimeChanged', 'productionDeployed', 'physicalDeviceAccepted', 'providerDeliveryAccepted',
  'releaseAccepted', 'cleanAudit', 'baseNativeFailureRepaired']) test(`rehashing cannot promote local TLS proof to ${key}`, () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-tls-evidence-'));
  try {
    const folder = resolve(temp, tlsAgentSecurityFolder); cpSync(resolve(root, tlsAgentSecurityFolder), folder, {recursive: true});
    const summary = JSON.parse(readFileSync(resolve(folder, 'summary.json'))); summary[key] = true;
    const bytes = JSON.stringify(summary); writeFileSync(resolve(folder, 'summary.json'), bytes);
    const hashes = JSON.parse(readFileSync(resolve(folder, 'artifact-sha256.json')));
    hashes['summary.json'] = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify(hashes));
    assert.throws(() => validateTlsAgentSecurity(temp));
  } finally {rmSync(temp, {recursive: true, force: true});}
});
test('installed CLI transport matches its lock and retains the patched compatible major', () => {
  const require = createRequire(import.meta.url), cli = createRequire(require.resolve('firebase-tools/package.json'));
  const installed = cli('undici/package.json'), lock = require('../package-lock.json');
  assert.equal(installed.version, lock.packages['node_modules/undici'].version);
  assert(require('semver').satisfies(installed.version, '>=6.29.1 <7'));
  assert(require('semver').satisfies(installed.version, cli('firebase-tools/package.json').dependencies.undici));
});
test('both required CI workflows execute real TLS regressions and evidence checks without masking failures', () => {
  for (const name of ['native-ci', 'web-integration-smoke']) {
    const workflow = parseDocument(readFileSync(resolve(root, '.github/workflows/' + name + '.yml'), 'utf8')).toJSON();
    const steps = Object.values(workflow.jobs).flatMap(job => job.steps ?? []);
    const matches = steps.filter(step => step.name === 'Test custom TLS certificate verification and retained scope');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].run, 'node --test tests/tls-agent-security.test.mjs tests/tls-agent-evidence.test.mjs');
    assert.equal(matches[0]['continue-on-error'], undefined); assert.equal(matches[0].if, undefined);
    for (const event of ['pull_request', 'push']) for (const file of ['tests/tls-agent-security.test.mjs',
      'tests/tls-agent-evidence.test.mjs', 'tests/helpers/tls-agent-probe.mjs']) assert(workflow.on[event].paths.includes(file));
  }
});
