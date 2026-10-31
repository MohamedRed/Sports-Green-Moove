import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const stage = process.argv[2]; assert.equal(process.argv.length, 3); assert(['before', 'after', 'compatibility'].includes(stage));
const root = resolve(import.meta.dirname, '../..');
const folder = resolve(root, 'docs/release/evidence/tls-agent-security-2026-10-30');
const destination = resolve(folder, stage); assert(!existsSync(destination), 'Trials are immutable');
mkdirSync(destination, {recursive: true});
const run = (command, args, filename, expected) => {
  console.log('Checking ' + filename);
  const child = spawnSync(command, args, {cwd: root, encoding: 'utf8', timeout: 300_000, maxBuffer: 8 * 1024 * 1024});
  assert.ifError(child.error); assert.equal(child.signal, null);
  writeFileSync(resolve(destination, filename), child.stdout, {flag: 'wx'});
  writeFileSync(resolve(destination, filename + '.stderr.txt'), child.stderr, {flag: 'wx'});
  assert.equal(child.status, expected, filename);
  return child.stdout;
};
if (stage === 'compatibility') {
  for (const [args, filename] of [
    [['ci', '--no-fund'], 'clean-install.txt'], [['run', 'build'], 'build.txt'],
    [['test'], 'functions.txt'], [['run', 'test:rules'], 'rules.txt'],
    [['run', 'test:stripe-webhook-flow'], 'payments.txt'], [['run', 'test:notification-reads'], 'notifications.txt'],
  ]) run('npm', args, filename, 0);
  console.log('Local compatibility checks completed. No production or phone acceptance.');
  process.exit(0);
}
copyFileSync(resolve(root, 'package-lock.json'), resolve(destination, 'lock.json'));
const audit = JSON.parse(run('npm', ['audit', '--json'], 'audit.json', 1));
const cases = run(process.execPath, ['--test', 'tests/tls-agent-security.test.mjs'], 'regression.txt', stage === 'before' ? 1 : 0);
assert.match(cases, stage === 'before' ? /# pass 1\n# fail 2/ : /# pass 3\n# fail 0/);
const sourceFiles = Object.fromEntries(['tests/tls-agent-security.test.mjs', 'tests/helpers/tls-agent-probe.mjs'].map(path => {
  const bytes = readFileSync(resolve(root, path));
  copyFileSync(resolve(root, path), resolve(destination, path.split('/').at(-1) + '.txt'));
  return [path, createHash('sha256').update(bytes).digest('hex')];
}));
writeFileSync(resolve(destination, 'source-sha256.json'), JSON.stringify(sourceFiles, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({stage, vulnerabilities: audit.metadata.vulnerabilities, passing: stage === 'before' ? 1 : 3}));
