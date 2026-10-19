const source = 'docs/release/evidence/local-contact-dialer-pass-2026-10-18/';
const identity = 'docs/release/evidence/emergency-child-identity-2026-10-19/';

export function createEmergencyFlow() {
  return { id: 'emergency-contact', title: 'Contact d’urgence', status: 'partial', checkedAt: '2026-10-19',
    summary: 'Un profil enfant recréé ne reprend plus l’ancien contact, dans l’essai local.',
    verified: 'Les essais de contact passent en local. Un profil enfant recréé ne récupère plus l’ancien contact ni son autorisation. Les anciens formulaires sont refusés.',
    remaining: 'Rejouer le nouveau contrôle dans l’app et sur téléphone, sans appeler. Terminer l’accès de l’enfant et l’entrée depuis un trajet.',
    ui: { source: source + 'emergency-contact-results.json', checkedAt: '2026-10-18', groups: ['emergency-contact-ui'] },
    local: { source: identity + 'services.json', checkedAt: '2026-10-19', groups: [
      'recreated-child-denies-obsolete-verification-read-edit-removal-and-committed-replay',
      'fresh-manager-verification-does-not-inherit-the-previous-childs-contact-or-version',
      'old-view-and-operation-identities-cannot-target-the-new-child-even-at-revision-zero',
      'a-concurrent-recreation-can-never-write-the-old-contact-into-the-new-child'],
    checks: ['Une ancienne autorisation ne suffit pas.', 'L’ancien contact reste séparé du nouveau profil.',
      'Un ancien formulaire ne peut pas enregistrer pour le nouveau profil.', 'Une modification simultanée ne mélange pas les contacts.'] },
    images: [{ file: 'emergency-passed-saved', alt: 'Contact fictif enregistré dans l’essai local réussi du 18 octobre' },
      { file: 'emergency-passed-restored', alt: 'Contact retrouvé après réouverture de l’écran, essai local du 18 octobre' },
      { file: 'emergency-passed-child', alt: 'Contact choisi par le parent de test déjà vérifié, essai local du 18 octobre' },
      { file: 'emergency-passed-revoked', alt: 'Contact masqué après retrait du droit parent, essai local du 18 octobre' },
      { file: 'emergency-passed-dialer', alt: 'Téléphone ouvert avec le numéro fictif, aucun appel lancé, essai local du 18 octobre' },
      { file: 'emergency-passed-removed', alt: 'Suppression confirmée et numéro effacé, essai local du 18 octobre' },
      { file: 'emergency-passed-account', alt: 'Aucun contact du compte précédent dans le nouveau compte, essai local du 18 octobre' },
      { file: 'emergency-editor-narrow', alt: 'Contact fictif sur petit écran, essai simulé du 18 octobre' },
      { file: 'emergency-editor-changed', alt: 'Numéro modifié et téléphone indisponible, essai simulé du 18 octobre' }],
    source: identity + 'README.md' };
}
