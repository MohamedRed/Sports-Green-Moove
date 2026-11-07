import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const folder = mkdtempSync(join(tmpdir(), 'sgm-publication-price-'));
try {
  writeFileSync(join(folder, 'main.swift'), `import Foundation
func check(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() { fatalError(message) }
}
checkTripPublicationPrice()
`);
  execFileSync('swiftc', ['-swift-version', '6',
    join(root, 'ios/Sources/SportsGreenMooveApp/TripPublicationPrice.swift'),
    join(root, 'ios/Tests/SportsGreenMooveNativeChecks/TripPublicationPriceChecks.swift'),
    join(folder, 'main.swift'), '-o', join(folder, 'checks')], {stdio: 'pipe', timeout: 90_000});
  const result = execFileSync(join(folder, 'checks'), [], {encoding: 'utf8', timeout: 90_000});
  assert(result.includes('exact cents across 100001 supported amounts'));
  process.stdout.write(result);
} finally {rmSync(folder, {recursive: true, force: true});}
