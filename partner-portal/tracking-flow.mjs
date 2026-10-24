const source = 'docs/release/evidence/location-freshness-2026-10-19/';

export function createTrackingFlow() {
  return { id: 'tracking', title: 'Sécurité enfant et suivi de trajet', status: 'untested', checkedAt: '2026-10-19',
    summary: 'L’âge des positions passe les essais locaux. Le suivi en direct sur téléphone reste à tester.',
    verified: 'Un ancien point ne remplace plus le plus récent. Le parent ne peut pas envoyer de position conducteur. Ces contrôles portent sur les données, pas sur un trajet réel.',
    remaining: 'Terminer l’affichage en direct et rejouer la reprise. Restent compte enfant, consentement, prise en charge, dépose, arrière-plan, verrouillage, pertes GPS/réseau, redémarrage, batterie et alertes de position.',
    images: [], source: source + 'README.md' };
}
