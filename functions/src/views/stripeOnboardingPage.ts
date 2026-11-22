import { stripeOnboardingCallbacks } from "../domain/stripeOnboarding.js";

const copy = {
  ready: ["VOTRE COMPTE EST PR&Ecirc;T", "Stripe confirme que votre compte peut recevoir les paiements et les versements."],
  pending: ["V&Eacute;RIFICATION EN COURS", "Votre compte n'est pas encore pr&ecirc;t pour les paiements. Vous pouvez reprendre la configuration depuis l'application."],
  invalid: ["CE LIEN A EXPIR&Eacute;", "Reprenez la configuration Stripe depuis votre compte conducteur dans l'application."],
  unavailable: ["STRIPE EST INDISPONIBLE", "La v&eacute;rification n'a pas pu aboutir. Reprenez la configuration depuis l'application dans quelques instants."],
};

export function renderStripeOnboardingPage(state: keyof typeof copy): string {
  const [title, detail] = copy[state];
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Sports Green-mOOVe - Stripe</title>
<style>
@font-face{font-family:"DM Sans";src:url("/fonts/dm_sans_regular.ttf") format("truetype");font-display:swap}
@font-face{font-family:"Bebas Neue";src:url("/fonts/bebas_neue_regular.ttf") format("truetype");font-display:swap}
:root{--c-green:#3EBD6C;--c-green-dark:#1A8A44;--bg-surface:#FFFFFF;--text-primary:#0C1B0E;--text-secondary:#3A5640;--font-body:"DM Sans",sans-serif;--font-display:"Bebas Neue",sans-serif}
*{box-sizing:border-box;letter-spacing:0}body{margin:0;background:var(--bg-surface);color:var(--text-primary);font-family:var(--font-body);line-height:1.6}
main{width:min(100%,760px);margin:0 auto;padding:48px 24px 80px}.wordmark{font-family:var(--font-display);font-size:28px;display:flex;align-items:baseline;flex-wrap:wrap;line-height:1.1;margin-bottom:88px}
.wordmark strong,.wordmark em{color:var(--c-green-dark)}.wordmark em{font-style:normal;font-size:1.8em}h1{font:40px/1.15 var(--font-display);margin:0 0 24px;overflow-wrap:anywhere}p{font-size:18px;color:var(--text-secondary);max-width:560px;margin:0 0 32px}
a{display:inline-flex;justify-content:center;padding:14px 22px;max-width:100%;background:var(--c-green-dark);color:var(--bg-surface);border-radius:8px;text-decoration:none;font-size:16px}a:hover{background:var(--text-primary)}a:focus-visible{outline:3px solid var(--c-green);outline-offset:4px}
@media(max-width:480px){main{padding-top:28px}.wordmark{font-size:24px;margin-bottom:64px}h1{font-size:32px}p{font-size:16px}a{width:100%}}
</style></head><body><main>
<div class="wordmark" aria-label="Sports Green Moove"><span>SPORTS&nbsp;</span><strong>GREEN-</strong><b>m</b><em>OO</em><b>Ve</b></div>
<h1>${title}</h1><p>${detail}</p><a href="${stripeOnboardingCallbacks.appReturnUrl}">Revenir &agrave; l'application</a>
</main></body></html>`;
}
