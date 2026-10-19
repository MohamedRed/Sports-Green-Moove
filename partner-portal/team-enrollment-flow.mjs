import { teamClubIdentityGroups } from '../scripts/qa/team-club-identity-evidence.mjs';
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
    local: { source: 'docs/release/evidence/team-club-identity-2026-10-19/passed/results.json', checkedAt: '2026-10-19',
      groups: [...teamClubIdentityGroups], checks: [
        'Un club recréé ne reprend pas les anciennes inscriptions d’équipe.',
        'Les parents doivent être vérifiés à nouveau pour ce club.',
        'Les anciennes pages ne rouvrent pas les accès.',
        'Une nouvelle validation permet une nouvelle inscription.',
      ] },
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
    source: 'docs/release/evidence/team-club-identity-2026-10-19/README.md' };
}
