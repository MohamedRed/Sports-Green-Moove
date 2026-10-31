import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { db } from './local-flow-client.mjs';
import { teamUi } from './local-team-native-fixture.mjs';

export async function checkTeamReviewBrowser(fixture, hooks) {
  const output = process.env.SGM_TEAM_REVIEW_UI_OUTPUT;
  assert(isAbsolute(output || '')); assert.equal(process.env.GCLOUD_PROJECT, 'demo-sgm-local-qa');
  process.env.VITE_USE_FIREBASE_EMULATOR = 'true';
  const server = await createServer({ root: resolve(import.meta.dirname, '../../admin'), server: { host: '127.0.0.1', port: 4194, strictPort: true } });
  const { chromium } = process.env.PLAYWRIGHT_MODULE_PATH ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href) : await import('playwright');
  let browser;
  const checks = [], screenshots = [], externalRequests = [], errors = [];
  const check = async (id, action) => { await action(); checks.push({ id, status: 'passed' }); };
  const events = async () => (await db.collection('teamEnrollmentEvents').where('teamId', '==', teamUi.teamId).get()).size;
  const record = async (id) => (await db.collection('teamEnrollments').doc(id).get()).data();
  mkdirSync(output, { recursive: true });
  try {
    await server.listen(); browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (!['localhost', '127.0.0.1'].includes(url.hostname)) { externalRequests.push(url.origin); await route.abort(); }
      else await route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
    const panel = page.locator('#team-review'), rows = panel.locator('[data-team-enrollment-id]');
    const row = (id) => panel.locator(`[data-team-enrollment-id="${id}"]`);
    const capture = async (name, targetId) => {
      if (targetId) await row(targetId).scrollIntoViewIfNeeded();
      else await panel.getByRole('heading', { name: 'Inscriptions aux équipes', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(output, name), fullPage: false }); screenshots.push(name);
    };
    const confirm = async (id, action) => {
      await row(id).getByRole('button', { name: action, exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click();
    };
    const loaded = async (count) => page.waitForFunction((expected) => document.querySelectorAll('#team-review [data-team-enrollment-id]').length === expected, count);
    const self = fixture.created.core.selfEnrollmentId, child = fixture.created.core.childEnrollmentId;
    await check('manager-sign-in-team-choice-and-request-pagination', async () => {
      await page.goto('http://127.0.0.1:4194');
      await page.getByLabel('Email', { exact: true }).fill('c@example.test');
      await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.SGM_QA_PASSWORD);
      await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
      await panel.getByLabel('Club pour les inscriptions aux équipes', { exact: true }).selectOption(teamUi.clubId);
      await panel.getByRole('button', { name: 'Autres équipes', exact: true }).click();
      await panel.getByLabel('Équipe pour les inscriptions', { exact: true }).selectOption(teamUi.teamId);
      await loaded(20); await panel.getByRole('button', { name: 'Inscriptions suivantes', exact: true }).click(); await loaded(25);
      assert.equal(new Set(await rows.evaluateAll((items) => items.map((item) => item.getAttribute('data-team-enrollment-id')))).size, 25);
      assert.equal(await page.locator('.app-shell').count(), 0);
    });
    await check('responsive-real-requests-desktop-tablet-mobile-and-large-text', async () => {
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1100 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}`);
        await capture(`team-review-requests-${width}.png`);
      }
      const originalFontSize = await page.locator('body').evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
      await page.addStyleTag({ content: 'html { font-size: 130%; }' });
      const enlargedFontSize = await page.locator('body').evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
      assert(Math.abs(enlargedFontSize / originalFontSize - 1.3) < 0.01);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await capture('team-review-large-text-320.png');
    });
    await check('cancelled-approval-does-not-write', async () => {
      const before = await events(); await row(self).getByRole('button', { name: 'Approuver', exact: true }).click();
      await page.getByRole('dialog').getByRole('heading', { name: 'Approuver cette inscription ?', exact: true }).waitFor();
      assert(await page.getByRole('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth));
      await page.screenshot({ path: resolve(output, 'team-review-confirmation-320.png'), fullPage: false }); screenshots.push('team-review-confirmation-320.png');
      await page.getByRole('dialog').getByRole('button', { name: 'Revenir', exact: true }).click();
      await page.locator('dialog').waitFor({ state: 'detached' }); assert.equal(await events(), before);
    });
    await check('manager-refusal-and-parent-new-request', async () => {
      const before = await events(); await confirm(self, 'Refuser');
      await panel.getByText('État actuel : Demande refusée.', { exact: true }).waitFor(); await loaded(20);
      assert.equal((await record(self)).status, 'refused'); assert.equal((await record(self)).revision, 2); assert.equal(await events(), before + 1);
      await hooks.requestSelfAgain(); await panel.getByRole('button', { name: 'Actualiser', exact: true }).click(); await loaded(20);
      if (!await row(self).count()) { await panel.getByRole('button', { name: 'Inscriptions suivantes', exact: true }).click(); await loaded(25); }
      await row(self).getByText('En attente', { exact: true }).waitFor();
    });
    await check('lost-approval-reply-clears-actions-and-reconciles-without-resubmitting', async () => {
      const before = await events(); let intercepted = 0;
      await page.route('**/transitionTeamEnrollment', async (route) => {
        if (route.request().method() !== 'POST') { await route.continue(); return; }
        intercepted++; await route.fetch(); await route.abort('failed');
      });
      await confirm(self, 'Approuver');
      await panel.getByText('Décision non confirmée. Actualisez avant de réessayer.', { exact: true }).waitFor();
      assert.equal(await rows.count(), 0); assert.equal(intercepted, 1); assert.equal(await events(), before + 1);
      assert.equal((await record(self)).status, 'approved'); assert.equal((await record(self)).revision, 4);
      await page.unroute('**/transitionTeamEnrollment'); await panel.getByRole('button', { name: 'Actualiser', exact: true }).click(); await loaded(20);
      if (!await row(self).count()) { await panel.getByRole('button', { name: 'Inscriptions suivantes', exact: true }).click(); await loaded(25); }
      await row(self).getByText('Inscription approuvée', { exact: true }).waitFor(); assert.equal(await events(), before + 1);
      await capture('team-review-approval-recovered-320.png', self);
    });
    await check('parent-withdrawal-is-visible-and-cannot-be-decided-again', async () => {
      await hooks.withdrawSelf(); await panel.getByRole('button', { name: 'Actualiser', exact: true }).click(); await loaded(20);
      if (!await row(self).count()) { await panel.getByRole('button', { name: 'Inscriptions suivantes', exact: true }).click(); await loaded(25); }
      await row(self).getByText('Demande retirée', { exact: true }).waitFor(); assert.equal(await row(self).getByRole('button').count(), 0);
    });
    await check('verified-child-approval-is-confirmed-in-the-manager-screen', async () => {
      if (!await row(child).count()) { await panel.getByRole('button', { name: 'Inscriptions suivantes', exact: true }).click(); await loaded(25); }
      const before = await events(); await confirm(child, 'Approuver');
      await panel.getByText('État actuel : Inscription approuvée.', { exact: true }).waitFor(); await loaded(20);
      assert.equal((await record(child)).status, 'approved'); assert.equal((await record(child)).revision, 2); assert.equal(await events(), before + 1);
      if (!await row(child).count()) { await panel.getByRole('button', { name: 'Inscriptions suivantes', exact: true }).click(); await loaded(25); }
      await capture('team-review-child-approved-320.png', child);
    });
    await check('guardian-loss-redacts-child-and-manager-can-remove-the-enrollment', async () => {
      await hooks.revokeGuardian(); await panel.getByRole('button', { name: 'Actualiser', exact: true }).click(); await loaded(20);
      if (!await row(child).count()) { await panel.getByRole('button', { name: 'Inscriptions suivantes', exact: true }).click(); await loaded(25); }
      await row(child).getByText('Nom indisponible', { exact: true }).waitFor();
      assert.equal(await panel.getByText('Enfant inscriptions QA', { exact: true }).count(), 0);
      const before = await events(); await confirm(child, "Retirer l'inscription");
      await panel.getByText('État actuel : Inscription retirée.', { exact: true }).waitFor(); await loaded(20);
      assert.equal((await record(child)).status, 'revoked'); assert.equal((await record(child)).revision, 3); assert.equal(await events(), before + 1);
      if (!await row(child).count()) { await panel.getByRole('button', { name: 'Inscriptions suivantes', exact: true }).click(); await loaded(25); }
      await capture('team-review-child-revoked-320.png', child);
    });
    await check('manager-access-loss-clears-private-rows-and-team-choices', async () => {
      await hooks.revokeManager(); await panel.getByRole('button', { name: 'Actualiser', exact: true }).click();
      await panel.getByRole('alert').waitFor(); assert.equal(await rows.count(), 0);
      assert.equal(await panel.getByLabel('Équipe pour les inscriptions').locator('option').count(), 1);
      assert.equal(await panel.getByLabel('Équipe pour les inscriptions').inputValue(), '');
      await panel.getByRole('button', { name: 'Actualiser les équipes', exact: true }).click();
      await panel.getByText('Impossible de charger les équipes. Actualisez les équipes.', { exact: true }).waitFor();
      assert.equal(await panel.getByLabel('Équipe pour les inscriptions').locator('option').count(), 1);
      await capture('team-review-access-revoked-320.png');
      await hooks.restoreManager();
    });
    await check('sign-out-and-parent-account-cannot-retain-manager-screen', async () => {
      await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
      await page.getByRole('button', { name: 'Se connecter', exact: true }).waitFor(); assert.equal(await page.locator('#team-review').count(), 0);
      await page.getByLabel('Email', { exact: true }).fill('p@example.test');
      await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.SGM_QA_PASSWORD);
      await page.getByRole('button', { name: 'Se connecter', exact: true }).click(); await page.getByRole('heading', { name: 'Accès réservé', exact: true }).waitFor();
      assert.equal(await page.locator('#team-review').count(), 0);
    });
    assert.deepEqual(externalRequests, []); assert.deepEqual(errors, []);
    return { checkedAt: new Date().toISOString(), scope: 'local-manager-browser-with-actual-emulated-services-not-native-or-physical', checks,
      screenshots, viewports: [1440, 768, 390, 320], largeTextScale: 1.3, externalRequests: 0, productionWrites: false };
  } finally { await browser?.close(); await server.close(); }
}
