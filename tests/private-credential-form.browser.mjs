import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {startPrivateCredentialForm} from '../scripts/qa/private-credential-form.mjs';

const {chromium} = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const temp = mkdtempSync(join(tmpdir(), 'sgm-input-browser-')), pipe = join(temp, 'credential.pipe');
execFileSync('/usr/bin/mkfifo', ['-m', '600', pipe]);
const output = process.env.PORTAL_QA_DIR; assert(output); mkdirSync(output, {recursive: true, mode: 0o700});
let received = null;
const form = await startPrivateCredentialForm(pipe, {deliver: async (_pipe, key) => {received = key;}});
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH});
try {
  const page = await browser.newPage();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({width, height: 844}); await page.goto(form.origin);
    await page.getByRole('heading', {name: 'Connexion du téléphone de test'}).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.equal(await page.getByLabel('Clé d’accès').getAttribute('type'), 'password');
    assert.equal(await page.getByLabel('Clé d’accès').inputValue(), '');
    await page.screenshot({path: join(output, 'empty-' + width + '.png'), fullPage: true});
  }
  const fictional = 'fictional-browser-test-input-only';
  await page.getByLabel('Clé d’accès').fill(fictional); await page.getByRole('button', {name: 'Connecter'}).click();
  await page.getByRole('status').filter({hasText: 'Saisie terminée.'}).waitFor();
  assert.equal(await page.getByLabel('Clé d’accès').inputValue(), ''); assert.equal(received, fictional);
  assert(!(await page.locator('body').innerText()).includes(fictional));
  await form.closed;
  console.log('Private input browser check passed at 1440, 390 and 320 pixels; fictional input delivered once and removed from the rendered form.');
} finally {await browser.close(); form.stop(); await form.closed; rmSync(temp, {recursive: true, force: true}); received = null;}
