const source = 'docs/release/evidence/child-contact-heading-pass-2026-10-19/';

export function createChildEmergencyFlow() {
  return { id: 'child-emergency', title: 'Contact d’urgence côté enfant', status: 'partial', checkedAt: '2026-10-19',
    summary: 'Le titre reste lisible sur petit écran, avec des réponses simulées.',
    verified: 'Le numéro disparaît si l’accès est refusé. Un changement demande une nouvelle confirmation ; aucun appel n’est lancé dans ces essais simulés.',
    remaining: 'Tester la connexion de l’enfant, son trajet et l’ouverture réelle du téléphone.',
    ui: { source: source + 'results.json', checkedAt: '2026-10-19', groups: ['child-contact-components'] },
    images: [
      { file: 'child-contact-narrow', alt: 'Titre complet et contact sur petit écran avec grand texte, essai simulé du 19 octobre' },
      { file: 'child-contact-denied', alt: 'Contact masqué après un refus simulé, essai d’écran du 19 octobre' },
      { file: 'child-contact-changed', alt: 'Numéro modifié et téléphone indisponible simulés, essai d’écran du 19 octobre', landscape: true },
    ], source: source + 'README.md' };
}
