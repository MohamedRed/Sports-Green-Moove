import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync, spawnSync} from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = resolve(root, 'tests/fixtures/ios-location');
const sourcePath = 'ios/Sources/SportsGreenMooveApp/NativeLocationFallbackProvider.swift';
const baseline = process.argv[2];
assert(!baseline || /^[a-f0-9]{40}$/.test(baseline), 'Supply an exact local baseline commit');
const build = mkdtempSync(resolve(tmpdir(), 'sgm-location-checks-'));
const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, {cwd: root, encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024, ...options});
  if (result.status !== 0) throw new Error(`${cmd} failed (${result.status}):\n${result.stdout ?? ''}${result.stderr ?? ''}`);
  return result;
};
try {
  const language = baseline ? '5' : '6';
  run('swiftc', ['-swift-version', language, '-emit-module', '-emit-object', '-parse-as-library', '-module-name', 'CoreLocation',
    resolve(fixture, 'CoreLocation.swift'), '-emit-module-path', resolve(build, 'CoreLocation.swiftmodule'),
    '-o', resolve(build, 'CoreLocation.o')]);
  const paths = ['Models.swift', 'BookingIntentSnapshot.swift', 'ReviewTripContext.swift', 'NativePlanPolicies.swift', 'LocationSessionState.swift',
    'ProviderConfigurationError.swift'].map(file => `ios/Sources/SportsGreenMooveApp/${file}`);
  for (const mode of baseline ? ['baseline', 'candidate'] : ['candidate']) {
    const source = mode === 'baseline' ? execFileSync('git', ['show', `${baseline}:${sourcePath}`], {cwd: root, encoding: 'utf8'}) :
      readFileSync(resolve(root, sourcePath), 'utf8');
    const guard = '#if os(iOS) && canImport(CoreLocation)';
    assert(source.includes(guard), 'Provider compilation guard changed; review the controlled wrapper check');
    const copy = resolve(build, `${mode}.swift`);
    writeFileSync(copy, source.replace(guard, '#if canImport(CoreLocation)'));
    const strict = baseline ? [] : ['-strict-concurrency=complete', '-warnings-as-errors'];
    const flags = mode === 'candidate' ? ['-D', 'CANDIDATE_LOCATION'] : [];
    const compile = run('swiftc', ['-swift-version', language, ...strict, ...flags, '-enable-bare-slash-regex', '-I', build,
      ...[...new Set(paths)].map(path => resolve(root, path)), copy, resolve(fixture, 'UploadProbe.swift'),
      resolve(fixture, 'main.swift'), resolve(fixture, 'CandidateChecks.swift'), resolve(build, 'CoreLocation.o'), '-o', resolve(build, mode)]);
    if (compile.stderr) process.stderr.write(`${mode} compiler:\n${compile.stderr}`);
    const result = run(resolve(build, mode), []);
    console.log(mode + '\n' + result.stdout.trim());
    if (mode === 'candidate') {
      assert(result.stdout.includes('startResult=cancelled'));
      assert(result.stdout.includes('continuousStartsAfterStop=0'));
      assert(result.stdout.includes('localStopCalls=1'));
      assert(result.stdout.includes('initialUploads=1'));
    }
  }
} finally { rmSync(build, {recursive: true, force: true}); }
