import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import ts from 'typescript';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';

const [input, destination] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert(isAbsolute(input ?? '') && isAbsolute(destination ?? '') && !existsSync(destination));
const before = JSON.parse(readFileSync(resolve(input, 'before.json'))), after = JSON.parse(readFileSync(resolve(input, 'after.json')));
const regression = JSON.parse(readFileSync(resolve(input, 'regression.json')));
assert.equal(before.completed, false); assert.equal(before.steps.at(-1).status, 'failed');
assert.equal(after.completed, true); assert.equal(after.steps.length, 7); assert(after.steps.every(row => row.status === 'passed'));
assert.equal(regression.steps.length, 24); assert(regression.steps.every(row => row.status === 'passed'));
const endpoints = await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (path, bytes) => {const target = resolve(destination, path); mkdirSync(resolve(target, '..'), {recursive: true}); writeFileSync(target, bytes, {flag: 'wx'});};
mkdirSync(destination, {recursive: true});
for (const name of ['before.json', 'after.json', 'regression.json', 'units.txt']) copyFileSync(resolve(input, name), resolve(destination, name));
const beforeSource = execFileSync('git', ['show', `${before.execution.baselineCommit}:functions/src/callables/inbox.ts`], {cwd: root});
assert.equal(hash(beforeSource), before.execution.inboxSourceSha256); save('before-inbox.ts.txt', beforeSource);
const beforeModule = ts.transpileModule(beforeSource.toString(), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText;
assert.equal(hash(beforeModule), before.execution.inboxModuleSha256); save('before-inbox.js.txt', beforeModule);
const module = readFileSync(resolve(root, 'functions/lib/callables/inbox.js'));
assert.equal(hash(module), after.execution.inboxModuleSha256); save('after-inbox.js.txt', module);
for (const [file, expected] of Object.entries(after.sourceFiles)) {
  const bytes = readFileSync(resolve(root, file)); assert.equal(hash(bytes), expected); save('source/' + file + '.txt', bytes);
}
save('disposal.json', JSON.stringify({scope: 'independent-loopback-endpoints-not-phone-proof', endpoints, checkedAt: new Date().toISOString()}, null, 2) + '\n');
const hashes = {};
const walk = (folder = '') => {
  for (const entry of readdirSync(resolve(destination, folder), {withFileTypes: true})) {
    const path = folder ? folder + '/' + entry.name : entry.name;
    if (entry.isDirectory()) walk(path); else hashes[path] = hash(readFileSync(resolve(destination, path)));
  }
};
walk(); save('artifact-sha256.json', JSON.stringify(hashes, null, 2) + '\n');
console.log('Retained the old-handler regression, corrected seven-case replay, 24 service groups and owned-endpoint disposal.');
