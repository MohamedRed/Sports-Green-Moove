import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { db } from './local-flow-client.mjs';

export async function checkGuardianReviewBrowser({ clubId, email }) {
  const output = process.env.SGM_GUARDIAN_UI_OUTPUT;
  assert(isAbsolute(output || ''), 'Provide an absolute screenshot output directory');
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-sgm-local-qa');
  const root = resolve(import.meta.dirname, '../..');
  process.env.VITE_USE_FIREBASE_EMULATOR = 'true';
  const server = await createServer({ root: resolve(root, 'admin'), server: { host: '127.0.0.1', port: 4193, strictPort: true } });
  const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
  const { chromium } = modulePath ? await import(pathToFileURL(modulePath).href) : await import('playwright');
  let browser;
  const checks = [], screenshots = [], externalRequests = [], errors = [];
  const check = async (id, action) => { await action(); checks.push({ id, status: 'passed' }); };
  const events = async () => (await db.collection('guardianVerificationEvents').get()).size;
  mkdirSync(output, { recursive: true });
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { externalRequests.push(url.origin); await route.abort(); }
      else await route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    const panel = page.locator('#guardian-review');
    const capture = async (file) => {
      await panel.getByRole('heading', { name: 'Vérification des parents', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(output, file), fullPage: false }); screenshots.push(file);
    };
    await check('manager-sign-in-and-private-request-list', async () => {
      await page.goto('http://127.0.0.1:4193');
      await page.getByLabel('Email', { exact: true }).fill(email);
      await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.SGM_QA_PASSWORD);
      await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
      await panel.getByLabel('Club pour vérifier les parents', { exact: true }).selectOption(clubId);
      await panel.locator('[data-guardian-id]').first().waitFor();
      assert.equal(await panel.locator('[data-guardian-id]').count(), 20);
      assert.equal(await page.locator('.app-shell').count(), 0);
    });
    await check('responsive-request-list-desktop-tablet-and-mobile', async () => {
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1100 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px`);
        await capture(`guardian-requests-${width}.png`);
      }
    });
    let target;
    await check('cancelled-confirmation-does-not-write', async () => {
      const before = await events();
      target = await panel.locator('[data-guardian-id]').filter({ has: page.getByRole('button', { name: 'Vérifier', exact: true }) }).first().getAttribute('data-guardian-id');
      await panel.locator(`[data-guardian-id="${target}"]`).getByRole('button', { name: 'Vérifier', exact: true }).click();
      await page.getByRole('dialog').getByRole('heading', { name: 'Confirmer le lien parent-enfant ?', exact: true }).waitFor();
      assert(await page.getByRole('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth));
      await page.screenshot({ path: resolve(output, 'guardian-confirmation-mobile.png'), fullPage: false });
      screenshots.push('guardian-confirmation-mobile.png');
      await page.getByRole('dialog').getByRole('button', { name: 'Revenir', exact: true }).click();
      await page.locator('dialog').waitFor({ state: 'detached' }); assert.equal(await events(), before);
    });
    await check('confirmed-verification-updates-real-record-and-one-audit-event', async () => {
      const before = await events();
      await panel.locator(`[data-guardian-id="${target}"]`).getByRole('button', { name: 'Vérifier', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click();
      await panel.getByText('État actuel : Parent vérifié.', { exact: true }).waitFor();
      await panel.locator(`[data-guardian-id="${target}"]`).getByRole('button', { name: 'Retirer la vérification', exact: true }).waitFor();
      assert.equal((await db.collection('guardianVerifications').doc(target).get()).get('status'), 'verified');
      assert.equal(await events(), before + 1); await capture('guardian-verified-mobile.png');
    });
    await check('revocation-is-confirmed-and-removes-verification-capability', async () => {
      await panel.locator(`[data-guardian-id="${target}"]`).getByRole('button', { name: 'Retirer la vérification', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click();
      await panel.getByText('État actuel : Vérification retirée.', { exact: true }).waitFor();
      assert.equal((await db.collection('guardianVerifications').doc(target).get()).get('status'), 'revoked');
      assert.equal(await panel.locator(`[data-guardian-id="${target}"] button`).count(), 0);
    });
    await check('refusal-is-separate-from-membership-approval', async () => {
      const row = panel.locator('[data-guardian-id]').filter({ has: page.getByRole('button', { name: 'Refuser', exact: true }) }).first();
      const id = await row.getAttribute('data-guardian-id');
      await row.getByRole('button', { name: 'Refuser', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click();
      await panel.getByText('État actuel : Demande refusée.', { exact: true }).waitFor();
      assert.equal((await db.collection('guardianVerifications').doc(id).get()).get('status'), 'refused');
    });
    await check('lost-reply-clears-stale-actions-and-reload-reconciles-real-result', async () => {
      const before = await events();
      const row = panel.locator('[data-guardian-id]').filter({ has: page.getByRole('button', { name: 'Vérifier', exact: true }) }).first();
      const id = await row.getAttribute('data-guardian-id'); let intercepted = 0;
      await page.route('**/transitionGuardianVerification', async (route) => {
        if (route.request().method() !== 'POST') { await route.continue(); return; }
        intercepted++; await route.fetch(); await route.abort('failed');
      });
      await row.getByRole('button', { name: 'Vérifier', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click();
      await panel.getByText('Décision non confirmée. Actualisez avant de réessayer.', { exact: true }).waitFor();
      assert.equal(await panel.locator('[data-guardian-id]').count(), 0); assert.equal(intercepted, 1);
      assert.equal(await events(), before + 1);
      await page.unroute('**/transitionGuardianVerification');
      await panel.getByRole('button', { name: 'Actualiser', exact: true }).click();
      await panel.locator(`[data-guardian-id="${id}"]`).getByText('Parent vérifié', { exact: true }).waitFor();
      assert.equal(await events(), before + 1); await capture('guardian-recovered-mobile.png');
    });
    await check('next-page-retains-all-twenty-five-distinct-requests', async () => {
      await panel.getByRole('button', { name: 'Demandes suivantes', exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('#guardian-review [data-guardian-id]').length === 25);
      const ids = await panel.locator('[data-guardian-id]').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-guardian-id')));
      assert.equal(new Set(ids).size, 25);
      await page.setViewportSize({ width: 1440, height: 1100 }); await capture('guardian-reviewed-desktop.png');
    });
    await check('sign-out-removes-the-private-manager-screen', async () => {
      await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
      await page.getByRole('button', { name: 'Se connecter', exact: true }).waitFor();
      assert.equal(await page.locator('#guardian-review').count(), 0);
    });
    assert.deepEqual(externalRequests, []); assert.deepEqual(errors, []);
    return { checkedAt: new Date().toISOString(), scope: 'local-management-browser-not-native-or-physical', checks, screenshots,
      viewports: [1440, 768, 390, 320], externalRequests: 0, productionWrites: false };
  } finally { await browser?.close(); await server.close(); }
}
