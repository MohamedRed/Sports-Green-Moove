import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = resolve(root, 'tests/fixtures/ios-emergency-phone');
const source = resolve(root, 'ios/Sources/SportsGreenMooveApp');
const out = mkdtempSync(resolve(tmpdir(), 'sgm-emergency-phone-'));
const flags = ['-swift-version', '6', '-strict-concurrency=complete', '-warnings-as-errors'];
try {
  const library = resolve(out, process.platform === 'darwin' ? 'libUIKit.dylib' : 'libUIKit.so');
  execFileSync('swiftc', [...flags, '-emit-library', '-emit-module', '-module-name', 'UIKit',
    resolve(fixture, 'UIKit.swift'), '-emit-module-path', resolve(out, 'UIKit.swiftmodule'), '-o', library], {stdio: 'pipe'});
  const binary = resolve(out, 'PhoneBoundaryChecks');
  execFileSync('swiftc', [...flags, '-parse-as-library', '-I', out, '-L', out, '-lUIKit',
    resolve(source, 'EmergencyContactModels.swift'), resolve(source, 'EmergencyContactWire.swift'),
    resolve(source, 'SystemEmergencyPhone.swift'), resolve(fixture, 'Checks.swift'), '-o', binary], {stdio: 'pipe'});
  const result = execFileSync(binary, [], {encoding: 'utf8', env: {...process.env, DYLD_LIBRARY_PATH: out, LD_LIBRARY_PATH: out}});
  process.stdout.write(result);
} finally { rmSync(out, {recursive: true, force: true}); }
