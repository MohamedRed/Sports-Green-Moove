import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, statSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {invitationRedemptionPath} from './invitation-same-origin-proxy.mjs';

const [directory, privateInput] = process.argv.slice(2);
assert([directory, privateInput].every(path => isAbsolute(path ?? '')));
assert.equal(statSync(privateInput).mode & 0o077, 0);
const fixture = JSON.parse(readFileSync(privateInput)), controller = JSON.parse(readFileSync(resolve(directory, 'controller.json')));
assert.equal(fixture.projectId, 'demo-sgm-local-qa'); assert.equal(fixture.runId, controller.runId);
assert(typeof fixture.password === 'string' && /^[a-f0-9]{48}$/.test(fixture.password), 'Unexpected isolated password shape; value withheld');
assert(fixture.email === 'browser-child@example.test', 'Unexpected synthetic email; value withheld');
const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
assert(modulePath && isAbsolute(modulePath));
const {chromium} = await import(pathToFileURL(modulePath).href);
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH});
const origin = 'http://127.0.0.1:4185';
const report = {scope: 'connected-same-origin-browser-signup-not-phone-share-or-parent-approval',
  projectId: fixture.projectId, runId: fixture.runId, completed: false, mismatchRefused: false,
  redemptionRequests: 0, wrongOriginRequests: 0, parentApprovalProven: false, physicalDevice: false,
  handlerInjected: false, productionWrites: false, providerRequests: 0,
  sourceFiles: Object.fromEntries(['scripts/qa/check-invitation-same-origin-browser.mjs',
    'scripts/qa/invitation-same-origin-proxy.mjs', 'admin/src/childInvitationGateway.ts', 'admin/src/childInvitationTestEndpoints.ts']
    .map(file => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))};
const observe = async phase => {
  const response = await fetch(origin + '/__qa/invitation-observe/' + phase,
    {method: 'POST', headers: {'x-sgm-local-observer': controller.runId}});
  assert.equal(response.status, 200); assert.equal((await response.json()).phase, phase);
};
let failed = false;
try {
  const page = await browser.newPage({viewport: {width: 390, height: 844}});
  page.on('request', request => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) report.providerRequests++;
    if (url.pathname === invitationRedemptionPath) {
      report.redemptionRequests++;
      if (url.origin !== origin) report.wrongOriginRequests++;
    }
  });
  await page.goto(origin + '/__qa/invitation-entry');
  await page.getByRole('heading', {name: 'Créer mon compte enfant', exact: true}).waitFor();
  await observe('before');
  await page.getByLabel('E-mail', {exact: true}).fill(fixture.email);
  await page.getByLabel('Mot de passe', {exact: true}).fill(fixture.password);
  await page.getByLabel('Confirmer le mot de passe', {exact: true}).fill('0' + fixture.password);
  await page.getByRole('button', {name: 'Créer mon compte', exact: true}).click();
  await page.getByRole('alert').filter({hasText: 'Les mots de passe ne correspondent pas.'}).waitFor();
  assert.equal(report.redemptionRequests, 0); report.mismatchRefused = true;
  await observe('mismatch');
  await page.getByLabel('Confirmer le mot de passe', {exact: true}).fill(fixture.password);
  await page.getByRole('button', {name: 'Créer mon compte', exact: true}).click();
  await page.getByRole('heading', {name: 'Compte créé', exact: true}).waitFor({timeout: 35_000});
  assert.equal(report.redemptionRequests, 1); assert.equal(report.wrongOriginRequests, 0); assert.equal(report.providerRequests, 0);
  await observe('created'); report.completed = true;
} catch {failed = true;}
finally {
  await browser.close(); fixture.password = '';
  writeFileSync(resolve(directory, 'same-origin-browser-check.json'), JSON.stringify({...report, failed}, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
}
if (failed) throw new Error('Connected same-origin signup did not complete; preserve its original report and dispose of the runtime.');
console.log('One connected same-origin child signup and mismatch rejection verified; no phone or parent approval accepted.');
