import assert from 'node:assert/strict';
import {content} from '../partner-portal/content.mjs';

export async function verifyPaymentReturnFollowup({page, base, output}) {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({width, height: 900});
    await page.goto(`${base}/#suite`);
    const blocker = page.locator('.blocker').filter({hasText: 'Rejouer l’inscription conducteur'});
    await blocker.waitFor();
    assert.match(await blocker.innerText(), /22 octobre/);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path: `${output}/payment-return-blocker-${width}.png`, fullPage: false});
    await page.goto(`${base}/#parcours/payments`);
    await page.getByRole('dialog').waitFor();
    const payments = content.flows.find(flow => flow.id === 'payments');
    await page.getByRole('dialog').getByText(payments.verified, {exact: true}).waitFor();
    await page.getByRole('dialog').getByText(payments.remaining, {exact: true}).waitFor();
    assert(await page.locator('dialog').evaluate(element => element.scrollWidth <= element.clientWidth));
    await page.screenshot({path: `${output}/payment-return-flow-${width}.png`, fullPage: true});
  }
}
