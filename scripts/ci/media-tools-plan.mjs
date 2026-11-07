import assert from 'node:assert/strict';
import { isAbsolute } from 'node:path';

export function ubuntuMediaSources({ platform, architecture, distribution, codename }) {
  assert.equal(platform, 'linux', 'Media installation is restricted to the Linux CI runner');
  assert.equal(architecture, 'x64', 'Only the declared amd64 Ubuntu CI runner is supported');
  assert.equal(distribution, 'ubuntu'); assert.match(codename, /^[a-z]{3,30}$/);
  const stanza = (uri, suites) => Object.entries({ Types: 'deb', URIs: uri, Suites: suites,
    Components: 'main restricted universe multiverse', Architectures: 'amd64',
    'Signed-By': '/usr/share/keyrings/ubuntu-archive-keyring.gpg' })
    .map(([key, value]) => `${key}: ${value}`).join('\n');
  return stanza('https://archive.ubuntu.com/ubuntu', `${codename} ${codename}-updates`) + '\n\n' +
    stanza('https://security.ubuntu.com/ubuntu', `${codename}-security`) + '\n';
}

export function mediaInstallCommands(sourcePath) {
  assert(isAbsolute(sourcePath) && sourcePath.endsWith('.sources'));
  const options = ['-o', `Dir::Etc::sourcelist=${sourcePath}`, '-o', 'Dir::Etc::sourceparts=-',
    '-o', 'Acquire::https::Timeout=30', '-o', 'Acquire::http::Timeout=30',
    '-o', 'Acquire::https::Dl-Limit=0', '-o', 'Acquire::http::Dl-Limit=0', '-o', 'Acquire::Retries=0'];
  return [
    ['sudo', ['apt-get', ...options, 'update', '--error-on=any']],
    ['sudo', ['apt-get', ...options, 'install', '--yes', '--no-install-recommends', 'ffmpeg']],
    ['ffmpeg', ['-version']], ['ffprobe', ['-version']],
  ];
}

export function executeMediaInstall(commands, run) {
  for (const [command, args] of commands) run(command, args);
}
