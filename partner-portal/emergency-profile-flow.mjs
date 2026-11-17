const source = 'docs/release/evidence/native-independent-61dc4cb-2026-10-20/';

export function createEmergencyProfileFlow() {
  return { id: 'emergency-profile', title: 'Contact d’un profil enfant recréé', status: 'partial', checkedAt: '2026-10-20',
    summary: 'L’ancien formulaire est refusé ; le nouveau profil garde son propre contact.',
    verified: 'Le parent n’accède plus à l’ancien contact. Après un nouvel accord, le nouveau contact reste enregistré à la réouverture.',
    remaining: 'Rejouer sur téléphone et tester la connexion de l’enfant lui-même.',
    ui: { source: source + 'emergency-identity/emergency-identity-results.json', checkedAt: '2026-10-20',
      groups: ['recreated-child-emergency-contact-ui'] },
    images: [
      { file: 'emergency-profile-original', alt: 'Contact fictif du profil initial, essai local du 20 octobre' },
      { file: 'emergency-profile-denied', alt: 'Ancien formulaire refusé après recréation du profil de test, essai local du 20 octobre' },
      { file: 'emergency-profile-empty', alt: 'Nouveau profil de test sans ancien contact après nouvel accord, essai local du 20 octobre' },
      { file: 'emergency-profile-restored', alt: 'Nouveau contact fictif retrouvé après réouverture, essai local du 20 octobre' },
    ], source: source + 'README.md' };
}
