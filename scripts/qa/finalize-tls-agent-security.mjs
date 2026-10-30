import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {connect} from 'node:net';

const root = resolve(import.meta.dirname, '../..');
const directory = resolve(root, 'docs/release/evidence/tls-agent-security-2026-10-30');
const save = (name, value) => writeFileSync(resolve(directory, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
assert(!existsSync(resolve(directory, 'artifact-sha256.json')), 'Trials are immutable');
for (const [file, pattern] of [['build', /@sports-green-moove\/website/], ['functions', /547 passed/],
  ['rules', /208 passed/], ['payments', /78 passed/], ['notifications', /19 passed/], ['clean-install', /added \d+ packages/]])
  assert.match(readFileSync(resolve(directory, 'compatibility', file + '.txt'), 'utf8'), pattern);
const ports = [4400, 4500, 5001, 8080, 9000, 9099, 9150, 9199];
for (const port of ports) assert(await new Promise(done => {
  const socket = connect({host: '127.0.0.1', port});
  socket.once('connect', () => {socket.destroy(); done(false);});
  socket.once('error', error => done(error.code === 'ECONNREFUSED'));
  socket.setTimeout(1000, () => {socket.destroy(); done(false);});
}), `Local endpoint remains open: ${port}`);
save('endpoints-closed.json', {host: '127.0.0.1', ports, closed: true});
const gh = args => {
  const result = spawnSync('gh', args, {cwd: root, encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024});
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr); return result.stdout;
};
save('base-native-job.json', JSON.parse(gh(['api', 'repos/MohamedRed/Sports-Green-Moove/actions/jobs/124330865782'])));
const log = gh(['api', 'repos/MohamedRed/Sports-Green-Moove/actions/jobs/124330865782/logs']);
const lines = log.split('\n'), start = lines.findIndex(line => line.endsWith('Emulator booted.\r') || line.endsWith('Emulator booted.'));
assert(start >= 0); const excerpt = lines.slice(start, start + 19).join('\n');
assert(excerpt.includes('input keyevent 82') && excerpt.includes('exit code 255'));
writeFileSync(resolve(directory, 'base-native-preparation-excerpt.txt'), excerpt, {flag: 'wx'});
save('summary.json', {scope: 'isolated-cli-transport-security-not-provider-or-release',
  baseHead: '199307ab6128a3bada97a2471d154c550bec71ae', beforeVersion: '6.26.0', afterVersion: '6.29.1',
  reproducedFailures: 2, correctedPassingCases: 3, externalRequestsInReproduction: 0,
  productionRuntimeChanged: false, productionDeployed: false, physicalDeviceAccepted: false,
  providerDeliveryAccepted: false, releaseAccepted: false, cleanAudit: false,
  baseNativeFailureRepaired: false, baseNativeRunId: 41133722663, baseNativeFailedJobId: 124330865782});
const files = readdirSync(directory, {recursive: true, withFileTypes: true}).filter(row => row.isFile())
  .map(row => resolve(row.parentPath, row.name).slice(directory.length + 1)).filter(name => name !== 'README.md').sort();
save('artifact-sha256.json', Object.fromEntries(files.map(name => [name,
  createHash('sha256').update(readFileSync(resolve(directory, name))).digest('hex')])));
console.log('TLS regression, compatibility, endpoint closure and separate native preparation failure retained.');
