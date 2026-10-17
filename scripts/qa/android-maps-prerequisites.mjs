import assert from 'node:assert/strict';

export function androidMapsPrerequisites(shell) {
  for (const name of ['com.android.vending', 'com.google.android.gms']) {
    const enabled = shell('pm', 'list', 'packages', '-e', '--user', '0', name).split('\n');
    assert(enabled.includes(`package:${name}`), `The rendering test image must enable ${name}`);
  }
  // Ignore the inactive factory copy when an updated system package is installed.
  const active = shell('dumpsys', 'package', 'com.google.android.gms').split(/^\s*Hidden system packages:/m)[0];
  const versions = [...active.matchAll(/^\s*versionName=(\d+)\.(\d+)\.(\d+)(?:\s|\(|$)/gm)];
  assert.equal(versions.length, 1, 'Exactly one active Play services version is required');
  const [major, minor, patch] = versions[0].slice(1).map(Number);
  assert(major > 21 || (major === 21 && (minor > 39 || (minor === 39 && patch >= 14))),
    'Maps rendering requires Play services 21.39.14 or later');
  return { playStoreEnabled: true, playServicesEnabled: true, playServicesVersion: `${major}.${minor}.${patch}` };
}
