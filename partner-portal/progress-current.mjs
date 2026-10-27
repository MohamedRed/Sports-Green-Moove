import { tripDraftPhoneProgress } from './trip-draft-phone.mjs';

export const currentProgress = [
  { date: '2026-10-27', title: 'Deux points restent à vérifier',
    text: 'Une capture de confirmation échoue et l’essai de coupure réseau ne démarre pas. Les dix essais séparés passent en simulation.',
    flow: 'native-startup', coversFlows: ['messages', 'team-conversation'],
    source: 'docs/release/evidence/render-network-gate-48ea950-2026-10-27/README.md' },
  tripDraftPhoneProgress,
];
