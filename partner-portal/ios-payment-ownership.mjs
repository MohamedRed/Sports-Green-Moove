const folder = 'docs/release/evidence/ios-payment-ownership-2026-11-04/';
export const iosPaymentOwnership = {
  source: folder + 'summary.json', checksums: folder + 'source-sha256.json', checkedAt: '2026-11-04',
};
export const iosPaymentOwnershipProgress = {
  date: '2026-11-04', title: 'Une ancienne confirmation ne revient plus après reconnexion',
  text: 'Le défaut est reproduit puis corrigé en local. Le paiement et la déconnexion restent à vérifier dans l’app sur iPhone.',
  flow: 'payments', coversFlows: ['signout'], source: folder + 'README.md',
};
