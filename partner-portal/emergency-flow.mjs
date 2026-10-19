const source = 'docs/release/evidence/local-contact-identity-pass-2026-10-19/';
const identity = 'docs/release/evidence/emergency-child-identity-2026-10-19/';

export function createEmergencyFlow() {
  return { id: 'emergency-contact', title: 'Contact d’urgence', status: 'partial', checkedAt: '2026-10-19',
    summary: 'Les contacts adulte et enfant passent dans l’app, lors du nouvel essai local.',
    verified: 'Enregistrement, réouverture, retrait du droit parent, suppression et changement de compte passent en local dans l’app. Le numéro fictif ouvre le téléphone sans appel.',
    remaining: 'Les contrôles locaux passent, mais l’accès de l’enfant dans l’app et l’essai du profil recréé restent à terminer. Puis rejouer sur téléphone, sans appeler. Le parcours en trajet a ses propres captures.',
    ui: { source: source + 'emergency-contact-results.json', checkedAt: '2026-10-19', groups: ['emergency-contact-ui'] },
    local: { source: identity + 'services.json', checkedAt: '2026-10-19', groups: [
      'recreated-child-denies-obsolete-verification-read-edit-removal-and-committed-replay',
      'fresh-manager-verification-does-not-inherit-the-previous-childs-contact-or-version',
      'old-view-and-operation-identities-cannot-target-the-new-child-even-at-revision-zero',
      'a-concurrent-recreation-can-never-write-the-old-contact-into-the-new-child'],
    checks: ['Une ancienne autorisation ne suffit pas.', 'L’ancien contact reste séparé du nouveau profil.',
      'Un ancien formulaire ne peut pas enregistrer pour le nouveau profil.', 'Une modification simultanée ne mélange pas les contacts.'] },
    images: [{ file: 'emergency-current-saved', alt: 'Contact fictif enregistré dans le nouvel essai local du 19 octobre' },
      { file: 'emergency-current-restored', alt: 'Contact retrouvé après réouverture de l’écran, essai local du 19 octobre' },
      { file: 'emergency-current-child', alt: 'Contact choisi après vérification du parent de test, essai local du 19 octobre' },
      { file: 'emergency-current-revoked', alt: 'Contact masqué après retrait du droit parent, essai local du 19 octobre' },
      { file: 'emergency-current-dialer', alt: 'Téléphone ouvert avec le numéro fictif, sans appel, essai local du 19 octobre' },
      { file: 'emergency-current-removed', alt: 'Suppression confirmée et numéro effacé, essai local du 19 octobre' },
      { file: 'emergency-current-account', alt: 'Nouveau compte sans le contact précédent, essai local du 19 octobre' },
      { file: 'emergency-editor-narrow', alt: 'Contact fictif sur petit écran, essai simulé du 18 octobre' },
      { file: 'emergency-editor-changed', alt: 'Numéro modifié et téléphone indisponible, essai simulé du 18 octobre' }],
    source: identity + 'README.md' };
}
