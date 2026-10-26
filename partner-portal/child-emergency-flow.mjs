const source = 'docs/release/evidence/child-contact-heading-pass-2026-10-19/';

export function createChildEmergencyFlow() {
  return { id: 'child-emergency', title: 'Contact d’urgence côté enfant', status: 'partial', checkedAt: '2026-10-26',
    summary: 'La liaison par le parent passe en local. Les captures restent simulées.',
    verified: 'Les codes expirés ou remplacés sont refusés. Deux confirmations simultanées ne créent qu’une liaison.',
    remaining: 'Terminer la création du compte et tester la connexion de l’enfant, son trajet, l’accès sans localisation sur téléphone et l’ouverture réelle du téléphone.',
    accountApproval: { source: 'docs/release/evidence/child-account-approval-2026-10-26/results.json',
      checksums: 'docs/release/evidence/child-account-approval-2026-10-26/artifact-sha256.json', checkedAt: '2026-10-26' },
    ui: { source: source + 'results.json', checkedAt: '2026-10-19', groups: ['child-contact-components'] },
    images: [
      { file: 'child-contact-narrow', alt: 'Titre complet et contact sur petit écran avec grand texte, essai simulé du 19 octobre' },
      { file: 'child-contact-denied', alt: 'Contact masqué après un refus simulé, essai d’écran du 19 octobre' },
      { file: 'child-contact-changed', alt: 'Numéro modifié et téléphone indisponible simulés, essai d’écran du 19 octobre', landscape: true },
    ], source: source + 'README.md' };
}
