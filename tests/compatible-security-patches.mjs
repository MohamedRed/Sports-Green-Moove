import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {parseDocument} from 'yaml';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {content} from '../partner-portal/content.mjs';
import {compatibleSecurityPatch, compatibleSecurityProgress} from '../partner-portal/compatible-security-patches.mjs';
import {assertCompatibleSecuritySummary, compatibleSecurityExcludedClaims, compatibleSecurityFolder,
  compatibleSecurityVersions, validateCompatibleSecurityEvidence} from '../scripts/qa/compatible-security-patches-evidence.mjs';

const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const json = name => JSON.parse(readFileSync(new URL('../' + compatibleSecurityFolder + name, import.meta.url)));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('the installed compatible patches retain an exact twelve-entry delta and unresolved high findings', () => {
  const summary = validateCompatibleSecurityEvidence(root); assert.equal(summary.highFindingsAfter, 5);
  const locked = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
  const semver = createRequire(require.resolve('firebase-tools/package.json'))('semver');
  for (const [path, [, fixed]] of Object.entries(compatibleSecurityVersions))
    assert(semver.gte(locked.packages[path].version, fixed), path);
});

test('fixed browser targets and both brace-expansion consumer lines retain ordinary behavior', () => {
  assert.deepEqual(require('browserslist')(['chrome 120', 'firefox 120']), ['chrome 120', 'firefox 120']);
  for (const prefix of ['', 'glob/node_modules/', 'readdir-glob/node_modules/', 'superstatic/node_modules/']) {
    const expand = require('../node_modules/' + prefix + 'brace-expansion');
    assert.deepEqual(expand('src/{parent,driver}/**/*.kt'), ['src/parent/**/*.kt', 'src/driver/**/*.kt']);
    assert.deepEqual(expand('literal'), ['literal']);
  }
});

test('the installed IP parser fixes link-local classification and refuses ambiguous IPv4 without a network request', () => {
  const {Address4, Address6} = require('ip-address');
  assert.equal(new Address6('fea0::1').isLinkLocal(), true);
  assert.equal(new Address6('fe80::1').isLinkLocal(), true);
  assert.throws(() => new Address4('010.0.0.1'));
  assert.equal(new Address4('8.8.8.8').correctForm(), '8.8.8.8');
  assert.equal(new Address6('2001:0db8:0000:0000:0000:0000:0000:0001').correctForm(), '2001:db8::1');
});

test('the SDK server constructor used by tooling loads without opening a transport or authenticating', async () => {
  const server = new McpServer({name: 'isolated-compatibility-check', version: '1.0.0'});
  assert.equal(typeof server.registerTool, 'function'); await server.close();
});

for (const key of compatibleSecurityExcludedClaims) test('security maintenance cannot promote ' + key, () => {
  const summary = json('summary.json'); summary[key] = true;
  assert.throws(() => assertCompatibleSecuritySummary(summary), {code: 'ERR_ASSERTION'});
});

test('an unrelated dependency change is rejected even after recomputing the candidate hashes', t => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-security-scope-'));
  t.after(() => rmSync(temporary, {recursive: true, force: true}));
  const folder = resolve(temporary, compatibleSecurityFolder);
  cpSync(resolve(root, compatibleSecurityFolder), folder, {recursive: true});
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), resolve(temporary, 'docs/release/evidence/source-archive'));
  const lock = JSON.parse(readFileSync(resolve(folder, 'lock-after.json')));
  lock.packages['node_modules/zod'].version = '0.0.0';
  const lockBytes = JSON.stringify(lock), summary = JSON.parse(readFileSync(resolve(folder, 'summary.json')));
  summary.afterLockSha256 = createHash('sha256').update(lockBytes).digest('hex');
  writeFileSync(resolve(folder, 'lock-after.json'), lockBytes);
  writeFileSync(resolve(folder, 'summary.json'), JSON.stringify(summary));
  const checksums = JSON.parse(readFileSync(resolve(folder, 'artifact-sha256.json')));
  for (const name of ['lock-after.json', 'summary.json'])
    checksums[name] = createHash('sha256').update(readFileSync(resolve(folder, name))).digest('hex');
  writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify(checksums));
  assert.throws(() => validateCompatibleSecurityEvidence(temporary), {code: 'ERR_ASSERTION'});
});

test('the portal adds only one brief security note and preserves all flows, media history and prior blockers', () => {
  const before = json('portal-before.json'), published = json('portal-v331.json'), after = json('portal-after-content.json');
  assert.equal(hash(after.flows), before.flowsSha256); assert.equal(after.flows.length, 34);
  assert.equal(hash(after.blockers), before.blockersSha256);
  assert.equal(after.updates.length, before.updatesCount + 1);
  assert.equal(hash(after.updates.filter(row => row.source !== compatibleSecurityProgress.source)), before.updatesSha256);
  const {assetRevision, evidenceFingerprints, mediaRevisions, shortClipBytes, updates: previousUpdates, ...previousContent} = published;
  const {compatibleSecurityPatch: addedReference, updates: nextUpdates, ...remainingContent} = after;
  assert.deepEqual(remainingContent, previousContent); assert.deepEqual(addedReference, compatibleSecurityPatch);
  const historical = new Set(nextUpdates.map(hash));
  assert.deepEqual(content.updates.filter(row => historical.has(hash(row))), nextUpdates);
  assert.deepEqual(content.compatibleSecurityPatch, compatibleSecurityPatch);
  assert.doesNotMatch(compatibleSecurityProgress.title + compatibleSecurityProgress.text, /Firebase|BrowserStack|gRPC|SDK|npm|MCP|Browserslist|ip-address/);
  assert.match(compatibleSecurityProgress.text, /cinq alertes élevées/);
  assert.equal(after.blockers.find(row => row.id === 'dependency-security').text,
    'Les alertes critiques sont levées. D’autres alertes élevées restent à traiter.');
});

test('the existing web dependency command imports and triggers on the new modular security contracts', () => {
  const source = readFileSync(new URL('./dependency-patch-evidence.test.mjs', import.meta.url), 'utf8');
  assert(source.includes("import './compatible-security-patches.mjs'"));
  const workflow = parseDocument(readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8')).toJSON();
  for (const event of ['push', 'pull_request']) assert(workflow.on[event].paths.includes('tests/compatible-security-patches.mjs'));
  assert(Object.values(workflow.jobs).some(job => (job.steps ?? []).some(s => s.run?.includes('tests/dependency-patch-evidence.test.mjs'))));
});
