import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {constants, mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync, symlinkSync} from 'node:fs';
import {request} from 'node:http';
import {open} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startPrivateCredentialForm, deliverPrivateCredential} from '../scripts/qa/private-credential-form.mjs';
import {credentialFormCsp, privateCredentialFormPage} from '../scripts/qa/private-credential-form-page.mjs';

const key = 'fictional-qa-key-not-a-provider-credential';
function pipeFixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'sgm-private-input-')); const pipe = join(folder, 'credential.pipe');
  execFileSync('/usr/bin/mkfifo', ['-m', '600', pipe]);
  t.after(() => rmSync(folder, {recursive: true, force: true})); return {folder, pipe};
}
const headers = origin => ({origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', 'x-sgm-qa-input': '1'});
const submit = (origin, value = key, override = {}) => fetch(origin + '/handoff', {method: 'POST',
  headers: {...headers(origin), ...override}, body: JSON.stringify({accessKey: value})});

test('the one-use form is loopback-only, uncached, inert when framed and never echoes the key', async t => {
  const {pipe, folder} = pipeFixture(t), delivered = [];
  const form = await startPrivateCredentialForm(pipe, {deliver: async (path, value) => delivered.push({path, value})});
  t.after(form.stop);
  assert.match(form.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  const page = await fetch(form.origin); assert.equal(page.status, 200);
  assert.equal(page.headers.get('cache-control'), 'no-store'); assert.equal(page.headers.get('content-security-policy'), credentialFormCsp);
  assert(credentialFormCsp.includes("frame-ancestors 'none'")); assert(credentialFormCsp.includes("default-src 'none'"));
  assert.equal(await page.text(), privateCredentialFormPage); assert(!privateCredentialFormPage.includes(key));
  assert(privateCredentialFormPage.includes('type="password"')); assert(privateCredentialFormPage.includes("input.value=''"));
  const result = await submit(form.origin); assert.equal(result.status, 204); assert.equal(await result.text(), '');
  assert.deepEqual(delivered, [{path: pipe, value: key}]); await form.closed;
  assert.deepEqual(readdirSync(folder), ['credential.pipe']);
  await assert.rejects(fetch(form.origin));
});

test('cross-site, missing-origin, form posts and host spoofing cannot reach the pipe', async t => {
  const {pipe} = pipeFixture(t); let calls = 0;
  const form = await startPrivateCredentialForm(pipe, {deliver: async () => {calls++;}}); t.after(form.stop);
  for (const override of [{origin: 'https://example.test'}, {origin: ''}, {'sec-fetch-site': 'cross-site'},
    {'x-sgm-qa-input': ''}, {'content-type': 'application/x-www-form-urlencoded'}]) {
    const response = await submit(form.origin, key, override); assert.equal(response.status, 403); await response.body.cancel();
  }
  const spoofed = await new Promise((resolve, reject) => {
    const outgoing = request(form.origin + '/handoff', {method: 'POST', headers: {...headers(form.origin), Host: 'example.test'}}, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    }); outgoing.on('error', reject); outgoing.end(JSON.stringify({accessKey: key}));
  });
  assert.equal(spoofed, 403);
  const options = await fetch(form.origin + '/handoff', {method: 'OPTIONS', headers: {origin: 'https://example.test'}});
  assert.equal(options.status, 404); assert.equal(options.headers.get('access-control-allow-origin'), null);
  assert.equal(calls, 0);
});

test('malformed or excessive input never exposes content or consumes the valid one-use delivery', async t => {
  const {pipe} = pipeFixture(t); let calls = 0;
  const form = await startPrivateCredentialForm(pipe, {deliver: async () => {calls++;}}); t.after(form.stop);
  for (const body of ['{', 'null', JSON.stringify({accessKey: key, other: 'value'}),
    JSON.stringify({accessKey: 'short'}), JSON.stringify({accessKey: 'x'.repeat(257)}),
    JSON.stringify({accessKey: key + '\n'}), JSON.stringify({accessKey: 'é'.repeat(129)})]) {
    const result = await fetch(form.origin + '/handoff', {method: 'POST', headers: headers(form.origin), body});
    assert.equal(result.status, 400); assert.equal(await result.text(), '');
  }
  const excessive = await fetch(form.origin + '/handoff', {method: 'POST', headers: headers(form.origin), body: 'x'.repeat(2000)});
  assert.equal(excessive.status, 413); assert.equal(await excessive.text(), ''); assert.equal(calls, 0);
  assert.equal((await submit(form.origin)).status, 204); assert.equal(calls, 1); await form.closed;
});

test('simultaneous submissions cannot write two keys, and a delivery failure is never retried', async t => {
  const {pipe} = pipeFixture(t); let release, calls = 0;
  const barrier = new Promise(resolve => {release = resolve;});
  const form = await startPrivateCredentialForm(pipe, {deliver: async () => {calls++; await barrier;}}); t.after(form.stop);
  const first = submit(form.origin);
  while (!calls) await new Promise(resolve => setTimeout(resolve, 5));
  const duplicate = await submit(form.origin); assert.equal(duplicate.status, 409); release();
  assert.equal((await first).status, 204); await form.closed; assert.equal(calls, 1);
  let failures = 0;
  const failed = await startPrivateCredentialForm(pipe, {deliver: async () => {failures++; throw new Error(key);}}); t.after(failed.stop);
  const response = await submit(failed.origin); assert.equal(response.status, 400); assert.equal(await response.text(), '');
  await failed.closed; assert.equal(failures, 1);
});

test('expiry and explicit stop close the listener even with an unfinished request', async t => {
  const {pipe} = pipeFixture(t);
  const expiring = await startPrivateCredentialForm(pipe, {deadlineMs: 100}); await expiring.closed;
  await assert.rejects(fetch(expiring.origin));
  const active = await startPrivateCredentialForm(pipe);
  const outgoing = request(active.origin + '/handoff', {method: 'POST', agent: false, headers: headers(active.origin)});
  outgoing.on('error', () => {});
  await new Promise(resolve => outgoing.on('socket', socket => socket.once('connect', resolve)));
  outgoing.write('{'); active.stop(); await active.closed; outgoing.destroy();
  await assert.rejects(fetch(active.origin));
});

test('only an owner-only named pipe accepts one bounded in-memory line; regular files and symlinks are refused', async t => {
  const {pipe, folder} = pipeFixture(t), reader = await open(pipe, constants.O_RDWR | constants.O_NONBLOCK);
  t.after(() => reader.close()); await deliverPrivateCredential(pipe, key);
  const bytes = Buffer.alloc(300), result = await reader.read(bytes); assert.equal(bytes.subarray(0, result.bytesRead).toString(), key + '\n');
  bytes.fill(0);
  for (const invalid of [key + '\n', 'x'.repeat(257), 'é'.repeat(129), '', null])
    await assert.rejects(deliverPrivateCredential(pipe, invalid));
  const file = join(folder, 'regular'); writeFileSync(file, '', {mode: 0o600});
  await assert.rejects(deliverPrivateCredential(file, key));
  await assert.rejects(startPrivateCredentialForm(file));
  assert.deepEqual(readdirSync(folder).sort(), ['credential.pipe', 'regular']);
  const link = join(folder, 'symlink'); symlinkSync(pipe, link);
  await assert.rejects(deliverPrivateCredential(link, key)); await assert.rejects(startPrivateCredentialForm(link));
  const nested = join(folder, 'not-private'); mkdirSync(nested, {mode: 0o755});
  const nestedPipe = join(nested, 'input'); execFileSync('/usr/bin/mkfifo', ['-m', '600', nestedPipe]);
  await assert.rejects(startPrivateCredentialForm(nestedPipe));
});
