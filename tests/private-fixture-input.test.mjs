import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync, chmodSync, symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {request} from 'node:http';
import test from 'node:test';
import {readPrivateFixturePassword, startPrivateFixtureInput} from '../scripts/qa/private-fixture-input.mjs';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'sgm-fixture-input-')), path = join(dir, 'input.json');
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  const value = {projectId: 'demo-sgm-local-qa', runId: 'a'.repeat(32), password: 'FictionalTestPasswordOnly'};
  writeFileSync(path, JSON.stringify(value), {mode: 0o600});
  return {dir, path, value};
}
test('masked fixture input requires an owned private demo file and rejects secret-bearing markup', t => {
  const {dir, path, value} = fixture(t);
  assert.equal(readPrivateFixturePassword(path), value.password);
  for (const invalid of [{...value, projectId: 'production'}, {...value, runId: 'bad'},
    {...value, password: '\"><script>secret</script>'}]) {
    writeFileSync(path, JSON.stringify(invalid)); assert.throws(() => readPrivateFixturePassword(path));
  }
  writeFileSync(path, JSON.stringify(value)); chmodSync(path, 0o644);
  assert.throws(() => readPrivateFixturePassword(path)); chmodSync(path, 0o600);
  chmodSync(dir, 0o755); assert.throws(() => readPrivateFixturePassword(path)); chmodSync(dir, 0o700);
  const link = join(dir, 'link'); symlinkSync(path, link); assert.throws(() => readPrivateFixturePassword(link));
});
test('one local page exposes only a masked field and closes its listener after delivery', async t => {
  const {path, value} = fixture(t), input = await startPrivateFixtureInput(path);
  t.after(() => input.stop());
  const status = headers => new Promise((resolve, reject) => {
    request(input.origin, {headers}, response => {response.resume(); resolve(response.statusCode);})
      .on('error', reject).end();
  });
  for (const headers of [{Origin: input.origin}, {Host: 'attacker.invalid'}, {'sec-fetch-site': 'cross-site'}])
    assert.equal(await status(headers), 403);
  assert.equal((await fetch(input.origin + '/other')).status, 404);
  const response = await new Promise((resolve, reject) => {
    request(input.origin, {headers: {'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document'}}, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({status: response.statusCode, headers: response.headers,
        html: Buffer.concat(chunks).toString()}));
    }).on('error', reject).end();
  });
  const {html} = response;
  assert.equal(response.status, 200); assert.equal(response.headers['cache-control'], 'no-store');
  assert.match(response.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert(html.includes('type="password"') && html.includes('readonly') && html.includes(value.password));
  assert(html.includes('>Afficher</button>') && !html.includes('form>'));
  assert.match(response.headers['content-security-policy'], /script-src 'sha256-[A-Za-z0-9+/=]+'/);
  await input.closed; await assert.rejects(fetch(input.origin));
});
test('an unused private fixture listener expires without disclosure', async t => {
  const {path} = fixture(t), input = await startPrivateFixtureInput(path, {deadlineMs: 100});
  await input.closed; await assert.rejects(fetch(input.origin));
});
