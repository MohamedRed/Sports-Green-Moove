import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {protocolQueryFolder, validateProtocolQuerySecurity} from './protocol-query-security-evidence.mjs';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2], base = resolve(root, protocolQueryFolder);
assert(input?.startsWith('/')); assertEvidenceBundleChecksums(base);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const servicesPath = resolve(input, 'sgm-protocol-query-services-20261106.json'), servicesBytes = readFileSync(servicesPath);
const services = JSON.parse(servicesBytes), transcript = readFileSync(resolve(input, 'sgm-protocol-query-services-20261106.log'), 'utf8');
assert.equal(services.projectId, 'demo-sgm-local-qa'); assert.equal(services.scope, 'local-emulated-services-not-phone-ui');
assert.equal(services.steps.length, 24); assert(services.steps.every(row => row.status === 'passed'));
assert(transcript.includes('Local QA: 24/24 groups passed. Evidence saved.'));
assert(transcript.includes('Script exited successfully (code 0)'));
const temp = transcript.match(/Watching "([^"\n]+\/sgm-local-runtime-[A-Za-z0-9]+)\/functions"/)[1];
assert(!existsSync(temp));
const closed = await assertLocalEndpointsClosed([4400, 4500, 5001, 8080, 9000, 9099, 9150, 9199]);
const hashes = JSON.parse(readFileSync(resolve(base, 'artifact-sha256.json')));
function record(file, value) {
  assert(!existsSync(resolve(base, file)));
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  writeFileSync(resolve(base, file), bytes, {flag: 'wx'}); hashes[file] = sha(bytes);
}
record('services.json', servicesBytes);
record('service-transcript.txt', transcript.split('\n').filter(line => /^(?:[\w-]+: passed|Local QA:|.*Script exited successfully|i  emulators: Shutting down)/.test(line)).join('\n') + '\n');
record('services-disposal.json', {checkedAt: new Date().toISOString(), runId: services.runId, isolatedRuntimeDirectoryAbsent: true,
  successfulRunnerExit: true, emulatorEndpoints: closed, earlierInterruptedAttemptAccepted: false});
for (const [kind, count] of [['payments', 78], ['rules', 219], ['notifications', 20]]) {
  const bytes = readFileSync(resolve(input, `sgm-protocol-query-${kind}-20261106.log`));
  const plain = bytes.toString().replace(/\x1b\[[0-9;]*m/g, '');
  assert(plain.includes(`Tests  ${count} passed (${count})`), kind + ' must actually complete');
  assert(plain.includes('Script exited successfully (code 0)')); record(kind + '.txt', bytes);
}
const sourceFiles = {};
for (const path of ['scripts/qa/run-local-flows.mjs', 'scripts/qa/local-flow-suite.mjs', 'scripts/qa/local-runtime.mjs',
  'scripts/qa/local-egress-guard.mjs', 'scripts/qa/local-runtime-disposal.mjs']) {
  const bytes = readFileSync(resolve(root, path)), hash = sha(bytes), target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(target)) writeFileSync(target, bytes, {flag: 'wx'}); assert.equal(sha(readFileSync(target)), hash); sourceFiles[path] = hash;
}
record('service-source-sha256.json', sourceFiles);
assert(!existsSync(temp));
const summary = JSON.parse(readFileSync(resolve(base, 'summary.json')));
Object.assign(summary, {serviceGroups: 24, serviceReplayAccepted: true, isolatedEnvironmentDestroyed: true,
  paymentCases: 78, rulesCases: 219, notificationCases: 20, cloudProviderFlowAccepted: false});
const bytes = JSON.stringify(summary, null, 2) + '\n'; writeFileSync(resolve(base, 'summary.json'), bytes); hashes['summary.json'] = sha(bytes);
writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n');
validateProtocolQuerySecurity(root); console.log('Retained fresh local service, payment, rules, notification and independent disposal proof; no release acceptance.');
