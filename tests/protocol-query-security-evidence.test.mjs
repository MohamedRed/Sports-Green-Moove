import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {protocolQueryFolder, validateProtocolQuerySecurity} from '../scripts/qa/protocol-query-security-evidence.mjs';
import {content} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('the exact compatible lock delta, unchanged probes, audits and local compatibility remain independently verifiable', () => {
  const summary = validateProtocolQuerySecurity(root);
  assert.equal(summary.releaseComplete, false); assert.equal(summary.remainingHighFindings, 5);
  const hashes = JSON.parse(readFileSync(resolve(root, protocolQueryFolder, 'baseline-sources.json'))).hashes;
  for (const path of ['tests/protocol-query-security.test.mjs', 'tests/helpers/protocol-query-security-probe.mjs'])
    assert.equal(sha(readFileSync(resolve(root, path))), hashes[path], 'Do not weaken the reproduced baseline');
});
for (const [file, change] of [
  ['summary.json', row => row.allSecurityFindingsResolved = true],
  ['summary.json', row => row.productionDeployed = true],
  ['summary.json', row => row.interruptedServiceAttemptAccepted = true],
  ['summary.json', row => row.cloudProviderFlowAccepted = true],
  ['summary.json', row => row.paymentCases = 999],
  ['services.json', row => row.steps.pop()],
  ['services-disposal.json', row => row.isolatedRuntimeDirectoryAbsent = false],
  ['lock-after.json', row => row.packages['node_modules/firebase'].version = '9.14.0'],
  ['lock-after.json', row => row.packages['node_modules/qs'].version = '6.15.2'],
  ['lock-after.json', row => row.packages[''].engines.node = '>=24'],
  ['audit-after.json', row => row.metadata.vulnerabilities.high = 0],
  ['baseline-sources.json', row => delete row.hashes['tests/helpers/protocol-query-security-probe.mjs']],
]) test('rehashed security evidence still rejects ' + change.toString(), t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-parser-evidence-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  const base = resolve(temp, protocolQueryFolder); cpSync(resolve(root, protocolQueryFolder), base, {recursive: true});
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), resolve(temp, 'docs/release/evidence/source-archive'));
  const path = resolve(base, file), value = JSON.parse(readFileSync(path)); change(value); writeFileSync(path, JSON.stringify(value));
  const hashes = JSON.parse(readFileSync(resolve(base, 'artifact-sha256.json'))); hashes[file] = sha(readFileSync(path));
  writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes));
  assert.throws(() => validateProtocolQuerySecurity(temp));
});
test('public result is local-only, retains outstanding alerts and adds no technology names or media', () => {
  const row = content.updates.find(row => row.source === protocolQueryFolder + 'README.md'); assert(row);
  assert.match(row.text, /24 groupes.*locaux/); assert.match(row.text, /Cinq alertes élevées/);
  assert.doesNotMatch(row.title + row.text, /Firebase|BrowserStack|Android|SDK|Stripe|protobuf|CI\b/);
  assert.equal(content.flows.length, 34);
});
