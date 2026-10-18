const source = 'docs/release/evidence/local-replay-34-2026-10-18/';

export function createEmergencyFlow() {
  return { id: 'emergency-contact', title: 'Contact d’urgence', status: 'partial', checkedAt: '2026-10-18',
    summary: 'Les écrans du contact passent les essais locaux.',
    verified: 'Enregistrement, suppression, réponse perdue et changement de numéro passent avec des réponses simulées. Le petit écran est vérifié.',
    remaining: 'Rejouer avec les contacts enregistrés et ouvrir le téléphone sans appeler. Terminer l’accès de l’enfant, puis tester sur téléphone.',
    ui: { source: source + 'contact-component-results.json', groups: [
      'saveReloadAndCancelledRemovalKeepTheConfirmedContact', 'lostReplyClearsTheFormAndExplicitRefreshDoesNotSubmitAgain',
      'aChangedNumberNeedsAnotherTapAndAnUnavailableDialerKeepsThatNumberVisible',
      'deniedFreshChildAuthorityRemovesThePreviouslyShownNumber', 'anInvalidLocalNumberNeverGetsSavedOrReplacedByAnotherDestination',
      'fieldsActionsAndRemovalConfirmationFitANarrowScreenWithLargeText'] },
    images: [{ file: 'emergency-editor-narrow', alt: 'Contact fictif sur petit écran, essai simulé du 18 octobre' },
      { file: 'emergency-editor-changed', alt: 'Numéro modifié et téléphone indisponible, essai simulé du 18 octobre' }],
    source: source + 'README.md' };
}
