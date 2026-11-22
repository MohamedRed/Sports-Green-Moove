const folder = 'docs/release/evidence/ledger-history-2026-10-24/';
const image = (phase, alt) => ({file: 'ledger-history-' + phase, alt: alt + ', essai local du 24 octobre'});

export function createImpactFlow(local, rideUi, shot) {
  return {id: 'impact', title: 'Impact et récompenses', status: 'partial', checkedAt: '2026-10-24', latestEvidence: 'phone',
    summary: 'Les totaux prennent aussi en compte les longs historiques.',
    verified: 'Historique complet et changement de compte testés sur téléphone, avec des données de test. Chaque compte retrouve ses propres totaux.',
    remaining: 'À rejouer sur iPhone. Aucun versement réel testé. Pas encore en ligne dans l’app.',
    profileLedgerPhone,
    ledgerHistory: {source: folder + 'summary.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-24'},
    ui: {...rideUi(['ride-ledgers-ui']), checkedAt: '2026-10-15'},
    local: {...local(['ride-audit-ledgers'], ['Le trajet terminé crée une écriture d’impact.', 'Une récompense est enregistrée.',
      'Une seconde clôture est refusée.']), checkedAt: '2026-10-15'},
    images: [...phoneLedgerImages, image('impact', 'Impact calculé sur les 257 trajets de test'), image('restored', 'Solde complet retrouvé au retour'),
      image('foreign', 'Solde distinct de l’autre compte de test'), image('return', 'Retour au solde du premier compte'),
      shot('ride-impact', 'Impact du trajet local du 15 octobre'), shot('ride-rewards', 'Solde du trajet local du 15 octobre')],
    tour: phoneLedgerTour, source: profileLedgerPhone.source.replace('summary.json', 'README.md')};
}
import {profileLedgerPhone, phoneLedgerImages, phoneLedgerTour} from './profile-ledger-phone.mjs';
