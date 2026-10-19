const source = 'docs/release/evidence/local-team-enrollment-sdk-2026-10-18/';
const native = 'docs/release/evidence/local-team-enrollment-native-2026-10-19/';

export function createTeamEnrollmentFlow() {
  return { id: 'team-enrollment', title: 'Inscription à une équipe', status: 'partial', checkedAt: '2026-10-19',
    summary: 'Demande, refus, accord et retrait passent maintenant dans l’app, avec les données de test.',
    verified: 'Dix vérifications passent, pour le parent et son enfant. Cinq captures sont ajoutées.',
    remaining: 'Rejouer avec le responsable du club et le parent dans l’app, après fermeture complète et sur téléphone. Ajouter l’historique et la conversation.',
    ui: { source: native + 'team-enrollment-results.json', groups: ['team-enrollment-ui'] },
    local: { source: source + 'fixtures.json', checkedAt: '2026-10-18', groups: [
      'fixture-parent-is-verified-by-two-actual-authenticated-transitions', 'reading-enrollment-views-does-not-create-an-enrollment',
      'owned-member-refusal-new-request-approval-and-withdrawal-have-five-events',
      'guardian-loss-denies-stale-child-withdrawal-without-an-enrollment-event',
      'exact-records-audit-actors-claims-and-unrelated-fixtures-stay-protected',
      'scoped-fixture-cleanup-restores-the-exact-prior-records-and-claims'],
    checks: ['Les demandes du parent et de l’enfant sont enregistrées.', 'Refus, nouvelle demande, accord et retrait passent en local.',
      'Un parent révoqué ne peut pas retirer une inscription approuvée.', 'Les données de test sont nettoyées sans changer les autres comptes.'] },
    images: [{ file: 'team-native-requested', alt: 'Demande enregistrée, en attente de la réponse du club, essai local du 19 octobre' },
      { file: 'team-native-approved', alt: 'Inscription du parent approuvée après une nouvelle lecture, essai local du 19 octobre' },
      { file: 'team-native-child-approved', alt: 'Inscription de l’enfant approuvée pour son parent vérifié, essai local du 19 octobre' },
      { file: 'team-native-child-ineligible', alt: 'Nom masqué après retrait des droits du parent, essai local du 19 octobre' },
      { file: 'team-native-other-account', alt: 'Le compte suivant ne retrouve pas les choix ni l’inscription du précédent, essai local du 19 octobre' }],
    source: native + 'README.md' };
}
