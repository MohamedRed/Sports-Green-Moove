const source = 'docs/release/evidence/ride-emergency-pass-2026-10-19/';

export function createRideEmergencyFlow() {
  return { id: 'ride-emergency', title: 'Urgence pendant un trajet', status: 'partial', checkedAt: '2026-10-19',
    summary: 'Conducteur et parent ouvrent leur contact, puis reviennent au même trajet dans l’essai local.',
    verified: 'Deux numéros distincts, aucun appel lancé, retour au trajet. Le suivi s’arrête en changeant de compte puis reprend côté conducteur, dans l’essai local.',
    remaining: 'Rejouer sur téléphone, sans appeler. Terminer l’accès du compte enfant. Le suivi réel et l’affichage de la carte restent à vérifier.',
    ui: { source: source + 'ride-emergency-results.json', checkedAt: '2026-10-19', groups: ['ride-emergency-active-ui'] },
    images: [
      ['driver-entry', 'Contact accessible depuis le trajet du conducteur'], ['driver-saved', 'Contact personnel du conducteur enregistré'],
      ['driver-dialer', 'Numéro fictif du conducteur affiché, sans appel'], ['driver-returned', 'Conducteur revenu au même trajet'],
      ['parent-entry', 'Même trajet ouvert côté parent, sans commandes conducteur'], ['parent-saved', 'Contact personnel distinct choisi par le parent'],
      ['parent-dialer', 'Numéro fictif du parent affiché, sans appel'], ['parent-returned', 'Parent revenu au même trajet'],
    ].map(([id, alt]) => ({ file: 'ride-emergency-' + id, alt: alt + ', essai local du 19 octobre' })),
    source: source + 'README.md' };
}
