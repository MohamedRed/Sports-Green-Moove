const source = 'docs/release/evidence/local-team-enrollment-sdk-2026-10-18/';
const native = 'docs/release/evidence/local-team-enrollment-native-2026-10-19/';
const phone = 'docs/release/evidence/phone-team-enrollment-2026-10-19/';

export function createTeamEnrollmentFlow() {
  return { id: 'team-enrollment', title: 'Inscription à une équipe', status: 'partial', checkedAt: '2026-10-19',
    summary: 'Le parent retrouve ses demandes et les réponses du club sur téléphone.',
    verified: 'L’historique reste accessible sans accès au club. Le retrait est conservé au retour. Sans autorisation parentale, le nom de l’enfant est masqué et sa demande n’est plus modifiable.',
    remaining: 'Tester après fermeture complète et sur d’autres appareils. Ajouter la conversation d’équipe. Pas encore en ligne.',
    ui: { source: native + 'team-enrollment-results.json', groups: ['team-enrollment-ui'] },
    phone: { source: phone + 'results.json' },
    historyPhone: { source: 'docs/release/evidence/phone-team-history-2026-10-19/results.json' },
    local: { source: source + 'fixtures.json', checkedAt: '2026-10-18', groups: [
      'fixture-parent-is-verified-by-two-actual-authenticated-transitions', 'reading-enrollment-views-does-not-create-an-enrollment',
      'owned-member-refusal-new-request-approval-and-withdrawal-have-five-events',
      'guardian-loss-denies-stale-child-withdrawal-without-an-enrollment-event',
      'exact-records-audit-actors-claims-and-unrelated-fixtures-stay-protected',
      'scoped-fixture-cleanup-restores-the-exact-prior-records-and-claims'],
    checks: ['Les demandes du parent et de l’enfant sont enregistrées.', 'Refus, nouvelle demande, accord et retrait passent en local.',
      'Un parent révoqué ne peut pas retirer une inscription approuvée.', 'Les données de test sont nettoyées sans changer les autres comptes.'] },
    images: [{ file: 'team-history-list', alt: 'Les demandes restent accessibles après la perte d’accès au club, essai sur téléphone du 19 octobre' },
      { file: 'team-history-page-2', alt: 'La liste continue au-delà des vingt premières demandes, essai sur téléphone du 19 octobre' },
      { file: 'team-history-confirmation', alt: 'Le retrait exige une confirmation, essai sur téléphone du 19 octobre' },
      { file: 'team-history-withdrawn', alt: 'Le retrait de l’inscription est enregistré, essai sur téléphone du 19 octobre' },
      { file: 'team-history-child', alt: 'Le nom de l’enfant est masqué et sa demande ne propose plus de modification, essai sur téléphone du 19 octobre' },
      { file: 'team-history-refreshed', alt: 'Le retrait reste enregistré après réouverture et actualisation, essai sur téléphone du 19 octobre' },
      { file: 'team-phone-requested', alt: 'Demande en attente sur le téléphone du parent, essai du 19 octobre' },
      { file: 'team-phone-refused', alt: 'Refus du club retrouvé sur le téléphone du parent, essai du 19 octobre' },
      { file: 'team-phone-requested-again', alt: 'Nouvelle demande après le refus, essai sur téléphone du 19 octobre' },
      { file: 'team-phone-manager-approved', alt: 'Le club a approuvé la nouvelle demande du parent, essai du 19 octobre', landscape: true },
      { file: 'team-phone-approved', alt: 'Accord du club retrouvé sur le téléphone du parent, essai du 19 octobre' },
      { file: 'team-phone-withdrawn', alt: 'Retrait confirmé par le parent sur son téléphone, essai du 19 octobre' },
      { file: 'team-phone-child-requested', alt: 'Demande pour l’enfant en attente du club, essai sur téléphone du 19 octobre' },
      { file: 'team-phone-manager-child-approved', alt: 'Le club a approuvé l’enfant sans rouvrir l’inscription retirée du parent, essai du 19 octobre', landscape: true },
      { file: 'team-phone-child-approved', alt: 'Inscription de l’enfant approuvée sur le téléphone de son parent vérifié, essai du 19 octobre' }],
    source: phone + 'README.md' };
}
