export function createPaymentsFlow(local, shot) {
  return { id: 'payments', title: 'Paiements et compte conducteur', status: 'partial', checkedAt: '2026-10-18',
    summary: 'Une reprise de paiement garde les mêmes frais, dans les essais locaux.',
    verified: 'Le montant et les frais restent identiques lors d’un nouvel essai. Les réponses incohérentes sont refusées. Les versements et remboursements restent vérifiés séparément.',
    remaining: 'Les pages de retour s’ouvrent à nouveau. Tester les écrans, l’inscription conducteur, les paiements réels sur téléphone et les remboursements, après fermeture aussi. Pas encore en ligne.',
    accountingEvidence: { checkedAt: '2026-10-23', source: 'docs/release/evidence/payout-accounting-2026-10-23/summary.json' },
    feeEvidence: {checkedAt: '2026-10-23', source: 'docs/release/evidence/payment-fees-2026-10-23/summary.json',
      checksums: 'docs/release/evidence/payment-fees-2026-10-23/artifact-sha256.json'},
    local: local(['ride-payment-confirmation'], ['Une confirmation tardive reste en attente.', 'Un enregistrement incomplet ne confirme pas le paiement.',
      'Un autre parent ne peut pas consulter ce paiement.', 'Vérifier ne lance pas un nouveau paiement.', 'Aucun paiement ni remboursement réel dans ces essais.'],
    'docs/release/evidence/local-payment-confirmation-2026-10-18/services.json'),
    ui: { source: 'docs/release/evidence/local-payment-layout-2026-10-18/results.json', groups: [
      'pendingPaymentOffersOnlyReadOnlyVerificationOnANarrowScreen', 'anInconsistentRecordRemainsExplicitlyUnconfirmed', 'aStatusReadDisablesRepeatedChecks'] },
    images: [shot('payment-pending-narrow', 'Confirmation en attente sur écran étroit, essai local du 18 octobre'),
      shot('payment-review', 'Paiement à vérifier, essai local du 18 octobre'),
      shot('payments', 'Écran de paiement vide lors de l’essai du 11 octobre')],
    source: 'docs/release/evidence/local-payment-confirmation-2026-10-18/README.md' };
}
