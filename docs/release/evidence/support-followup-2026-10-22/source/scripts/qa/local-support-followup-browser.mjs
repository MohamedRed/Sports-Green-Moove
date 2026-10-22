import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { call, db } from './local-flow-client.mjs';

export async function checkSupportFollowupBrowser({ parent }) {
  const output = process.env.SGM_SUPPORT_UI_OUTPUT;
  assert(isAbsolute(output || '')); assert.equal(process.env.GCLOUD_PROJECT, 'demo-sgm-local-qa');
  const { reportId } = await call('createReport', parent, { subjectType: 'other', reason: 'Support visuel QA', description: 'Demande fictive pour verifier le suivi.' });
  const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
  const { chromium } = modulePath ? await import(pathToFileURL(modulePath).href) : await import('playwright');
  process.env.VITE_USE_FIREBASE_EMULATOR = 'true';
  const server = await createServer({ root: resolve(import.meta.dirname, '../../admin'), server: { host: '127.0.0.1', port: 4193, strictPort: true } });
  const checks = [], screenshots = [], externalRequests = [], errors = [];
  let browser;
  mkdirSync(output, { recursive: true });
  const check = async (id, action) => { await action(); checks.push({ id, status: 'passed' }); };
  try {
    await server.listen(); browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', async route => {
      if (!['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)) { externalRequests.push(new URL(route.request().url()).origin); await route.abort(); }
      else await route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const row = page.locator(`[data-support-report="${reportId}"]`);
    await check('administrator-opens-separate-private-note-and-public-response-fields', async () => {
      await page.goto('http://127.0.0.1:4193'); await page.getByLabel('Email', { exact: true }).fill('support-admin@example.test');
      await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.SGM_QA_PASSWORD);
      await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
      await row.waitFor(); await row.getByLabel('Note interne', { exact: true }).fill('NOTE PRIVEE QA');
      await row.getByRole('button', { name: 'Review', exact: true }).click();
      await row.getByText('Rapport en revue', { exact: true }).waitFor();
      await row.getByLabel('Réponse au demandeur', { exact: true }).fill('Votre demande a été traitée. Merci pour votre retour.');
      await row.getByLabel('Statut après réponse', { exact: true }).selectOption('closed');
    });
    await check('response-form-fits-desktop-and-small-mobile', async () => {
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        const form = row.locator('.support-reply-form'); await form.scrollIntoViewIfNeeded();
        assert(await form.evaluate(element => element.scrollWidth <= element.clientWidth));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}`);
        const file = `support-response-${width}.png`; await page.screenshot({ path: resolve(output, file) }); screenshots.push(file);
      }
    });
    let intercepted = 0;
    await check('lost-confirmation-keeps-one-immutable-explicit-retry', async () => {
      await page.route('**/respondToReport', async route => {
        if (route.request().method() !== 'POST') { await route.continue(); return; }
        intercepted++; await route.fetch(); await route.abort('failed');
      });
      await row.getByRole('button', { name: 'Envoyer la réponse', exact: true }).click();
      await row.getByRole('button', { name: 'Réessayer cet envoi', exact: true }).waitFor();
      assert.equal(intercepted, 1); assert(await row.getByLabel('Réponse au demandeur', { exact: true }).isDisabled());
      assert(await row.getByLabel('Note interne', { exact: true }).isDisabled());
      assert.equal((await db.collection('reports').doc(reportId).get()).get('publicReplyCount'), 1);
      await page.unroute('**/respondToReport');
      await row.getByRole('button', { name: 'Réessayer cet envoi', exact: true }).click();
      await row.getByText('Réponse enregistrée pour le demandeur.', { exact: true }).waitFor();
      assert.equal(await row.getByLabel('Réponse au demandeur', { exact: true }).inputValue(), '');
      const stored = (await db.collection('reports').doc(reportId).get()).data();
      assert.equal(stored.publicReplyCount, 1); assert.equal(stored.status, 'closed'); assert.equal(stored.reviewNote, 'NOTE PRIVEE QA');
    });
    await check('requester-reads-written-response-and-status-but-never-internal-notes', async () => {
      const detail = await call('getMySupportReport', parent, { reportId });
      assert.equal(detail.report.status, 'closed'); assert.equal(detail.replies.items.length, 1);
      assert.equal(detail.replies.items[0].text, 'Votre demande a été traitée. Merci pour votre retour.');
      assert.doesNotMatch(JSON.stringify(detail), /NOTE PRIVEE|reviewNote|authorUid|digest/);
      const file = 'support-response-confirmed-mobile.png'; await row.locator('.support-reply-form').scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(output, file) }); screenshots.push(file);
    });
    await check('sign-out-removes-private-response-controls', async () => {
      await page.getByRole('button', { name: 'Sortir', exact: true }).click();
      await page.getByRole('button', { name: 'Se connecter', exact: true }).waitFor();
      assert.equal(await page.locator('[data-support-report]').count(), 0);
    });
    assert.deepEqual(externalRequests, []); assert.deepEqual(errors, []);
    return { checkedAt: new Date().toISOString(), scope: 'local-admin-browser-not-requester-native-or-phone', checks, screenshots,
      viewports: [1440, 768, 390, 320], externalRequests: 0, productionWrites: false };
  } finally { await browser?.close(); await server.close(); }
}
