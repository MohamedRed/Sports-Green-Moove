import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..'), baseline = process.argv.includes('--baseline');
const source = '959e70b41abb039037f94e6eeec8402b597b5bff';
const read = path => baseline ? execFileSync('git', ['show', `${source}:${path}`], {cwd: root}) : readFileSync(resolve(root, path));
const script = read('scripts/check-ios-native-plan.sh').toString();
const files = [...script.matchAll(/\$\{ROOT_DIR\}\/([^"\n]+\.swift)"/g)].map(match => match[1]);
assert(files.length > 100); assert.equal(new Set(files).size, files.length);
const main = 'ios/Tests/SportsGreenMooveNativeChecks/main.swift'; assert(files.includes(main));
if (baseline) {
  const screen = read('ios/Sources/SportsGreenMooveApp/SearchScreen.swift').toString();
  for (const [field, action] of [['form', 'invalidateSearch()'], ['originInput', 'invalidatePlace(.origin)'],
    ['destinationInput', 'invalidatePlace(.destination)'], ['appState.searchOrigin', 'invalidateSearch()'],
    ['appState.searchDestination', 'invalidateSearch()']])
    assert(screen.includes(`.onChange(of: ${field}) { _, _ in appState.${action} }`));
}
const directory = mkdtempSync(resolve(tmpdir(), 'sgm-search-selection-')), hashes = {};
try {
  const inputs = files.filter(path => path !== main).map((path, index) => {
    const bytes = read(path); hashes[path] = createHash('sha256').update(bytes).digest('hex');
    const target = resolve(directory, `${index}-${basename(path)}`); writeFileSync(target, bytes); return target;
  });
  const fixture = `tests/fixtures/ios-search-selection/${baseline ? 'baseline' : 'candidate'}.swift`;
  const bytes = readFileSync(resolve(root, fixture)); hashes[fixture] = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(resolve(directory, 'main.swift'), bytes);
  const compiler = spawnSync('swiftc', ['-D', 'DEBUG', '-swift-version', '6', ...inputs, resolve(directory, 'main.swift'), '-o', resolve(directory, 'check')],
    {cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024});
  if (compiler.stdout) process.stdout.write(compiler.stdout); if (compiler.stderr) process.stderr.write(compiler.stderr);
  assert.ifError(compiler.error); assert.equal(compiler.status, 0, 'Actual application and fixture compilation must succeed');
  const result = spawnSync(resolve(directory, 'check'), [], {cwd: directory, encoding: 'utf8', timeout: 30000, maxBuffer: 128 * 1024});
  if (result.stdout) process.stdout.write(result.stdout); if (result.stderr) process.stderr.write(result.stderr);
  assert.ifError(result.error); assert.equal(result.status, 0, 'Search selection checks must finish');
  console.log(JSON.stringify({mode: baseline ? 'retained-deferred-callback-order' : 'actual-synchronous-selection-state',
    baselineCommit: source, compiledInputs: inputs.length, sourceSha256: hashes, nativeScreenCauseConfirmed: false}));
} finally {rmSync(directory, {recursive: true, force: true});}
