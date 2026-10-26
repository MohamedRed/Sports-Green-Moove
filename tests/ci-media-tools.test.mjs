import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseDocument } from 'yaml';
import { ubuntuMediaSources, mediaInstallCommands, executeMediaInstall } from '../scripts/ci/media-tools-plan.mjs';

const config = { platform: 'linux', architecture: 'x64', distribution: 'ubuntu', codename: 'noble' };
test('the original cancelled download is retained without accepting its skipped user-flow tests', () => {
  const read = name => readFileSync(new URL('../docs/release/evidence/ci-media-preparation-2026-10-26/' + name, import.meta.url));
  const job = JSON.parse(read('people-job.json')), hashes = JSON.parse(read('artifact-sha256.json'));
  assert.equal(job.id, 121753205002); assert.equal(job.head_sha, 'f773b3df5f656103323ab51a8db83b124db7beb9');
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'cancelled');
  const install = job.steps.find(row => row.name === 'Install media inspection tools');
  assert.equal(install.conclusion, 'cancelled');
  assert(Date.parse(install.completed_at) - Date.parse(install.started_at) > 18 * 60_000);
  const flows = job.steps.filter(row => row.name.startsWith('Test '));
  assert(flows.length > 10); assert(flows.every(row => row.conclusion === 'skipped'));
  const excerpt = read('download-excerpt.log').toString();
  assert(excerpt.includes('Need to get 62.8 MB')); assert(excerpt.includes('http://azure.archive.ubuntu.com/ubuntu'));
  assert(excerpt.includes('Fetched 12.6 MB in 1s'));
  assert.deepEqual(Object.keys(hashes).sort(), ['README.md', 'people-job.json', 'download-excerpt.log'].sort());
  for (const [name, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(name)).digest('hex'), hash);
});
test('media preparation uses only official HTTPS Ubuntu sources with signing and security updates', () => {
  const sources = ubuntuMediaSources(config);
  assert(sources.includes('URIs: https://archive.ubuntu.com/ubuntu\nSuites: noble noble-updates'));
  assert(sources.includes('URIs: https://security.ubuntu.com/ubuntu\nSuites: noble-security'));
  assert.equal((sources.match(/Signed-By: \/usr\/share\/keyrings\/ubuntu-archive-keyring.gpg/g) ?? []).length, 2);
  assert(!/http:|azure|Trusted:|Allow-Insecure:/.test(sources));
  for (const patch of [{ platform: 'darwin' }, { architecture: 'arm64' }, { distribution: 'debian' },
    { codename: '' }, { codename: 'noble\nTrusted: yes' }]) assert.throws(() => ubuntuMediaSources({ ...config, ...patch }));
});
test('update, installation and both required executables remain mandatory without a stale-index fallback', () => {
  const commands = mediaInstallCommands('/tmp/sgm-ci/ubuntu.sources');
  assert.equal(commands.length, 4);
  assert(commands[0][1].includes('--error-on=any')); assert(commands[1][1].includes('ffmpeg'));
  for (const row of commands.slice(0, 2)) {
    assert.equal(row[0], 'sudo'); assert(row[1].includes('Dir::Etc::sourceparts=-'));
    assert(!row[1].some(arg => /allow-unauthenticated|AllowInsecure|Verify-Peer=false/.test(arg)));
  }
  assert.deepEqual(commands.slice(2), [['ffmpeg', ['-version']], ['ffprobe', ['-version']]]);
  for (let failure = 0; failure < commands.length; failure++) {
    const invoked = [];
    assert.throws(() => executeMediaInstall(commands, (command, args) => {
      invoked.push([command, args]); if (invoked.length === failure + 1) throw new Error('injected preparation failure');
    }));
    assert.deepEqual(invoked, commands.slice(0, failure + 1));
  }
});
test('the installer refuses a personal-machine invocation before running any package manager', () => {
  const result = spawnSync(process.execPath, ['scripts/ci/install-media-tools.mjs'], {
    cwd: new URL('..', import.meta.url), env: { PATH: process.env.PATH, GITHUB_ACTIONS: 'false', RUNNER_OS: 'Linux' }, encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert(result.stderr.includes('Do not install CI packages on a personal computer'));
});
test('both smoke lanes use the same bounded installer without widening their existing job deadlines', () => {
  const workflow = parseDocument(readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8')).toJSON();
  for (const event of ['pull_request', 'push']) {
    assert(workflow.on[event].paths.includes('scripts/ci/**'));
    assert(workflow.on[event].paths.includes('tests/ci-media-tools.test.mjs'));
  }
  for (const [name, timeout] of [['smoke', 30], ['people-safety', 20]]) {
    const job = workflow.jobs[name], step = job.steps.find(row => row.name === 'Install media inspection tools');
    assert.equal(job['timeout-minutes'], timeout); assert.equal(step['timeout-minutes'], 5);
    assert.equal(step.run, 'node --test tests/ci-media-tools.test.mjs && node scripts/ci/install-media-tools.mjs');
    assert.equal(step['continue-on-error'], undefined);
  }
});
