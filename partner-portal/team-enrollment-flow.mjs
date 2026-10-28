import { teamClubIdentityGroups } from '../scripts/qa/team-club-identity-evidence.mjs';
import { teamConnectionRecoveryPhone } from './team-connection-recovery.mjs';
import { teamRestartPhone, teamRestartImages } from './team-process-restart.mjs';
const native = 'docs/release/evidence/local-team-enrollment-native-2026-10-19/';
const phone = 'docs/release/evidence/phone-team-enrollment-2026-10-19/';

export function createTeamEnrollmentFlow() {
  return { id: 'team-enrollment', title: 'Inscription à une équipe', status: 'partial', checkedAt: '2026-10-28', latestEvidence: 'phone',
    summary: 'Les inscriptions du parent et de l’enfant reviennent après fermeture complète.',
    verified: 'Demande, refus, nouvel envoi, accord et retrait : les sept étapes reviennent sur téléphone après fermeture complète. L’inscription de l’enfant reste distincte. Captures de session du 28 octobre.',
    remaining: 'Confirmer les notifications et le parcours sur d’autres appareils. Pas encore en ligne.',
    restartPhone: teamRestartPhone,
    connectionRecoveryPhone: teamConnectionRecoveryPhone,
    ui: { source: native + 'team-enrollment-results.json', checkedAt: '2026-10-19', groups: ['team-enrollment-ui'] },
    phone: { source: phone + 'results.json', checkedAt: '2026-10-19' },
    historyPhone: { source: 'docs/release/evidence/phone-team-history-2026-10-19/results.json', checkedAt: '2026-10-19' },
    local: { source: 'docs/release/evidence/team-club-identity-2026-10-19/passed/results.json', checkedAt: '2026-10-19',
      groups: [...teamClubIdentityGroups], checks: [
        'Un club recréé ne reprend pas les anciennes inscriptions d’équipe.',
        'Les parents doivent être vérifiés à nouveau pour ce club.',
        'Les anciennes pages ne rouvrent pas les accès.',
        'Une nouvelle validation permet une nouvelle inscription.',
      ] },
    images: [...teamRestartImages, { file: 'team-history-list', alt: 'Les demandes restent accessibles après la perte d’accès au club, essai sur téléphone du 19 octobre' },
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
