import {driverConnectChecks, driverConnectImages} from './driver-connect.mjs';

export function createPaymentsFlow(local, shot) {
  return { id: 'payments', title: 'Paiements et compte conducteur', status: 'partial', checkedAt: '2026-10-25',
    summary: 'L’ouverture du compte conducteur est protégée en local.',
    verified: 'En local, les doubles appuis et les anciens liens sont bloqués. Le texte agrandi reste lisible. Les montants et frais restent identiques lors des reprises testées.',
    remaining: 'Choisir la commission, puis tester l’inscription conducteur, les paiements réels sur téléphone et les remboursements. Vérifier la reprise après fermeture et iPhone. Pas encore en ligne.',
    driverConnectChecks,
    accountingEvidence: { checkedAt: '2026-10-23', source: 'docs/release/evidence/payout-accounting-2026-10-23/summary.json' },
    feeEvidence: {checkedAt: '2026-10-23', source: 'docs/release/evidence/payment-fees-2026-10-23/summary.json',
      checksums: 'docs/release/evidence/payment-fees-2026-10-23/artifact-sha256.json'},
    local: {...local(['ride-payment-confirmation'], ['Une confirmation tardive reste en attente.', 'Un enregistrement incomplet ne confirme pas le paiement.',
      'Un autre parent ne peut pas consulter ce paiement.', 'Vérifier ne lance pas un nouveau paiement.', 'Aucun paiement ni remboursement réel dans ces essais.'],
    'docs/release/evidence/local-payment-confirmation-2026-10-18/services.json'), checkedAt: '2026-10-18'},
    ui: { checkedAt: '2026-10-18', source: 'docs/release/evidence/local-payment-layout-2026-10-18/results.json', groups: [
      'pendingPaymentOffersOnlyReadOnlyVerificationOnANarrowScreen', 'anInconsistentRecordRemainsExplicitlyUnconfirmed', 'aStatusReadDisablesRepeatedChecks'] },
    images: [...driverConnectImages, shot('payment-pending-narrow', 'Confirmation en attente sur écran étroit, essai local du 18 octobre'),
      shot('payment-review', 'Paiement à vérifier, essai local du 18 octobre'),
      shot('payments', 'Écran de paiement vide lors de l’essai du 11 octobre')],
    source: 'docs/release/evidence/local-payment-confirmation-2026-10-18/README.md' };
}
