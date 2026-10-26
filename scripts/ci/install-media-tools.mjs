import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { ubuntuMediaSources, mediaInstallCommands, executeMediaInstall } from './media-tools-plan.mjs';

assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Do not install CI packages on a personal computer');
assert.equal(process.env.RUNNER_OS, 'Linux');
assert.equal(process.platform, 'linux');
const release = execFileSync('/bin/sh', ['-c', '. /etc/os-release; printf "%s\\n%s\\n" "$ID" "$VERSION_CODENAME"'],
  { encoding: 'utf8', timeout: 5000 }).trim().split('\n');
const sources = ubuntuMediaSources({ platform: process.platform, architecture: process.arch,
  distribution: release[0], codename: release[1] });
assert(existsSync('/usr/share/keyrings/ubuntu-archive-keyring.gpg'), 'Ubuntu archive signing keyring is required');
const directory = mkdtempSync(resolve(tmpdir(), 'sgm-ci-media-')), path = resolve(directory, 'ubuntu.sources');
const started = Date.now(), deadline = started + 240_000;
try {
  // The apt sandbox user needs read access; this file contains public repository metadata only.
  chmodSync(directory, 0o755); writeFileSync(path, sources, { mode: 0o644, flag: 'wx' });
  executeMediaInstall(mediaInstallCommands(path), (command, args) => {
    const remaining = deadline - Date.now(); assert(remaining > 0, 'Media preparation exceeded its four-minute budget');
    execFileSync(command, args, { stdio: 'inherit', timeout: remaining });
  });
  console.log(JSON.stringify({ scope: 'ci-media-tool-preparation-not-user-flow-proof',
    officialHttpsSources: true, signatureVerificationRequired: true, elapsedMs: Date.now() - started }));
} finally { rmSync(directory, { recursive: true, force: true }); }
