const source = 'docs/release/evidence/local-contact-identity-pass-2026-10-19/';
const identity = 'docs/release/evidence/emergency-child-identity-2026-10-19/';
const phoneCaptions = {
  empty: 'Aucun contact enregistré', saved: 'Contact du parent enregistré',
  restored: 'Contact retrouvé après fermeture complète', child: 'Contact de l’enfant enregistré',
  revoked: 'Contact masqué après retrait du droit parent', cancelled: 'Contact conservé après annulation',
  removed: 'Suppression confirmée', 'other-account': 'Autre compte sans le contact précédent',
};

export function createEmergencyFlow() {
  return { id: 'emergency-contact', title: 'Contact d’urgence', status: 'partial', checkedAt: '2026-10-21',
    summary: 'Les contacts du parent et de l’enfant passent sur téléphone réel.',
    verified: 'Enregistrement, retour après fermeture, retrait du droit parent, annulation de suppression, suppression et changement de compte passent avec des données de test.',
    remaining: 'L’ouverture du téléphone reste à vérifier, sans appeler. Terminer aussi l’accès de l’enfant pendant son trajet.',
    dialerPreflight: { source: 'docs/release/evidence/emergency-dialer-preflight-2026-10-21/results.json' },
    dialerPreflightRecheck: { source: 'docs/release/evidence/emergency-dialer-preflight-2026-10-23/results.json',
      checkedAt: '2026-10-23', checksums: 'docs/release/evidence/emergency-dialer-preflight-2026-10-23/artifact-sha256.json' },
    phone: { source: 'docs/release/evidence/emergency-phone-2026-10-21/results.json', checkedAt: '2026-10-21' },
    ui: { source: source + 'emergency-contact-results.json', checkedAt: '2026-10-19', groups: ['emergency-contact-ui'] },
    local: { source: identity + 'services.json', checkedAt: '2026-10-19', groups: [
      'recreated-child-denies-obsolete-verification-read-edit-removal-and-committed-replay',
      'fresh-manager-verification-does-not-inherit-the-previous-childs-contact-or-version',
      'old-view-and-operation-identities-cannot-target-the-new-child-even-at-revision-zero',
      'a-concurrent-recreation-can-never-write-the-old-contact-into-the-new-child'],
    checks: ['Une ancienne autorisation ne suffit pas.', 'L’ancien contact reste séparé du nouveau profil.',
      'Un ancien formulaire ne peut pas enregistrer pour le nouveau profil.', 'Une modification simultanée ne mélange pas les contacts.'] },
    images: ['empty', 'saved', 'restored', 'child', 'revoked', 'cancelled', 'removed', 'other-account'].map(id => ({
      file: 'emergency-phone-' + id, alt: phoneCaptions[id] + ', téléphone réel, 21 octobre',
    })).concat([{ file: 'emergency-current-saved', alt: 'Contact fictif enregistré dans le nouvel essai local du 19 octobre' },
      { file: 'emergency-current-restored', alt: 'Contact retrouvé après réouverture de l’écran, essai local du 19 octobre' },
      { file: 'emergency-current-child', alt: 'Contact choisi après vérification du parent de test, essai local du 19 octobre' },
      { file: 'emergency-current-revoked', alt: 'Contact masqué après retrait du droit parent, essai local du 19 octobre' },
      { file: 'emergency-current-dialer', alt: 'Téléphone ouvert avec le numéro fictif, sans appel, essai local du 19 octobre' },
      { file: 'emergency-current-removed', alt: 'Suppression confirmée et numéro effacé, essai local du 19 octobre' },
      { file: 'emergency-current-account', alt: 'Nouveau compte sans le contact précédent, essai local du 19 octobre' },
      { file: 'emergency-editor-narrow', alt: 'Contact fictif sur petit écran, essai simulé du 18 octobre' },
      { file: 'emergency-editor-changed', alt: 'Numéro modifié et téléphone indisponible, essai simulé du 18 octobre' }]),
    source: 'docs/release/evidence/emergency-phone-2026-10-21/README.md' };
}
