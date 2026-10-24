const folder = 'docs/release/evidence/ledger-history-2026-10-24/';
const image = (phase, alt) => ({file: 'ledger-history-' + phase, alt: alt + ', essai local du 24 octobre'});

export function createImpactFlow(local, rideUi, shot) {
  return {id: 'impact', title: 'Impact et récompenses', status: 'partial', checkedAt: '2026-10-24', latestEvidence: 'local',
    summary: 'Les totaux prennent aussi en compte les longs historiques.',
    verified: '257 écritures testées dans l’app, en local. Le solde complet est conservé au retour et reste propre au compte.',
    remaining: 'À rejouer sur téléphone et iPhone. Aucun versement réel testé. Pas encore en ligne.',
    ledgerHistory: {source: folder + 'summary.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-24'},
    ui: {...rideUi(['ride-ledgers-ui']), checkedAt: '2026-10-15'},
    local: {...local(['ride-audit-ledgers'], ['Le trajet terminé crée une écriture d’impact.', 'Une récompense est enregistrée.',
      'Une seconde clôture est refusée.']), checkedAt: '2026-10-15'},
    images: [image('impact', 'Impact calculé sur les 257 trajets de test'), image('restored', 'Solde complet retrouvé au retour'),
      image('foreign', 'Solde distinct de l’autre compte de test'), image('return', 'Retour au solde du premier compte'),
      shot('ride-impact', 'Impact du trajet local du 15 octobre'), shot('ride-rewards', 'Solde du trajet local du 15 octobre')],
    tour: [
      {image: 'ledger-history-impact', title: 'Compter tous les trajets', text: 'Les 257 trajets de test sont pris en compte.'},
      {image: 'ledger-history-restored', title: 'Retrouver le solde complet', text: 'Le solde inclut aussi les retraits et remboursements simulés.'},
      {image: 'ledger-history-foreign', title: 'Changer de compte', text: 'L’autre compte garde son propre solde.'},
      {image: 'ledger-history-return', title: 'Revenir à son compte', text: 'Le premier solde revient sans changement.'},
    ], source: folder + 'README.md'};
}
