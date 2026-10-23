import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { evidenceSourcePaths, fingerprintEvidence } from '../partner-portal/evidence-fingerprints.mjs';
import { content } from '../partner-portal/content.mjs';

test('newly named and deeply nested evidence records cannot be omitted by a field allowlist', () => {
  const record = {futureProof: {nested: [{source: 'docs/example/result.json', checksums: 'docs/example/checksums.json'}]}};
  assert.deepEqual(evidenceSourcePaths(record), ['docs/example/checksums.json', 'docs/example/result.json']);
  const all = evidenceSourcePaths(content);
  for (const id of ['payments', 'notification-settings', 'support-urgent']) {
    const flow = content.flows.find(row => row.id === id);
    for (const record of [flow.accountingEvidence, flow.notificationPermissionPhone, flow.notificationNativeRecheck, flow.urgentSupportPhone].filter(Boolean))
      for (const key of ['source', 'checksums'].filter(key => record[key])) assert(all.includes(record[key]));
  }
});
test('changed source bytes change the fingerprint without changing the record name or date', t => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-portal-fingerprints-'));
  t.after(() => rmSync(root, {recursive: true, force: true})); mkdirSync(resolve(root, 'docs'));
  const record = {futureProof: {source: 'docs/proof.json'}};
  writeFileSync(resolve(root, 'docs/proof.json'), '{"passed":false}'); const before = fingerprintEvidence(root, record);
  writeFileSync(resolve(root, 'docs/proof.json'), '{"passed":true}'); const after = fingerprintEvidence(root, record);
  assert.notEqual(before['docs/proof.json'], after['docs/proof.json']);
});
test('repeated references are deduplicated, but metadata cycles are rejected', () => {
  const record = {source: 'docs/proof.json'};
  assert.deepEqual(evidenceSourcePaths({a: record, b: [record]}), ['docs/proof.json']);
  const cyclic = {}; cyclic.self = cyclic; assert.throws(() => evidenceSourcePaths(cyclic), /cycles/);
});
test('invalid or external evidence references fail before reading arbitrary files', () => {
  for (const source of ['../private', '/private/key', 'https://example.test/private', 'docs/../private', 'docs//proof.json', 'docs\\proof.json', 42, null])
    assert.throws(() => evidenceSourcePaths({source}), /canonical repository document paths/);
});
