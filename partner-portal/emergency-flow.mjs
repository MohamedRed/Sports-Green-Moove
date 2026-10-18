const source = 'docs/release/evidence/local-contact-dialer-pass-2026-10-18/';

export function createEmergencyFlow() {
  return { id: 'emergency-contact', title: 'Contact d’urgence', status: 'partial', checkedAt: '2026-10-18',
    summary: 'Le numéro enregistré ouvre le téléphone, sans lancer d’appel, dans l’essai local.',
    verified: 'Enregistrement, réouverture, retrait du droit parent, téléphone, suppression et changement de compte passent en local.',
    remaining: 'Terminer l’accès de l’enfant et l’entrée depuis un trajet. Rejouer sur téléphone, sans appeler.',
    ui: { source: source + 'emergency-contact-results.json', groups: ['emergency-contact-ui'] },
    images: [{ file: 'emergency-passed-saved', alt: 'Contact fictif enregistré dans l’essai local réussi du 18 octobre' },
      { file: 'emergency-passed-restored', alt: 'Contact retrouvé après réouverture de l’écran' },
      { file: 'emergency-passed-child', alt: 'Contact choisi par le parent de test déjà vérifié' },
      { file: 'emergency-passed-revoked', alt: 'Contact masqué après retrait du droit parent' },
      { file: 'emergency-passed-dialer', alt: 'Téléphone ouvert avec le numéro fictif, aucun appel lancé' },
      { file: 'emergency-passed-removed', alt: 'Suppression confirmée et numéro effacé' },
      { file: 'emergency-passed-account', alt: 'Aucun contact du compte précédent dans le nouveau compte' },
      { file: 'emergency-editor-narrow', alt: 'Contact fictif sur petit écran, essai simulé du 18 octobre' },
      { file: 'emergency-editor-changed', alt: 'Numéro modifié et téléphone indisponible, essai simulé du 18 octobre' }],
    source: source + 'README.md' };
}
