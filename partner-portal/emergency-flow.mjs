const source = 'docs/release/evidence/local-replay-34-2026-10-18/';

export function createEmergencyFlow() {
  return { id: 'emergency-contact', title: 'Contact d’urgence', status: 'partial', checkedAt: '2026-10-18',
    summary: 'Le contact revient après réouverture en local. Le téléphone reste à vérifier.',
    verified: 'L’app affiche le contact enregistré puis rechargé. L’essai s’arrête en attendant le téléphone. Les six essais d’écran simulés passent séparément.',
    remaining: 'Rejouer avec les contacts enregistrés et ouvrir le téléphone sans appeler. Terminer l’accès de l’enfant, puis tester sur téléphone.',
    ui: { source: source + 'contact-component-results.json', groups: [
      'saveReloadAndCancelledRemovalKeepTheConfirmedContact', 'lostReplyClearsTheFormAndExplicitRefreshDoesNotSubmitAgain',
      'aChangedNumberNeedsAnotherTapAndAnUnavailableDialerKeepsThatNumberVisible',
      'deniedFreshChildAuthorityRemovesThePreviouslyShownNumber', 'anInvalidLocalNumberNeverGetsSavedOrReplacedByAnotherDestination',
      'fieldsActionsAndRemovalConfirmationFitANarrowScreenWithLargeText'] },
    images: [{ file: 'emergency-native-saved', alt: 'Contact fictif affiché comme enregistré avant l’arrêt de l’essai local' },
      { file: 'emergency-native-restored', alt: 'Contact fictif relu après réouverture de l’écran, avant l’arrêt de l’essai local' },
      { file: 'emergency-native-child', alt: 'Contact de l’enfant affiché avec un lien parent déjà vérifié pour cet essai' },
      { file: 'emergency-native-revoked', alt: 'Contact masqué après retrait du lien parent vérifié, avant l’arrêt de l’essai' },
      { file: 'emergency-editor-narrow', alt: 'Contact fictif sur petit écran, essai simulé du 18 octobre' },
      { file: 'emergency-editor-changed', alt: 'Numéro modifié et téléphone indisponible, essai simulé du 18 octobre' }],
    source: 'docs/release/evidence/local-contact-dialer-failure-2026-10-18/README.md' };
}
