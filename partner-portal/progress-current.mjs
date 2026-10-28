import { tripDraftPhoneProgress } from './trip-draft-phone.mjs';
import { chatNetworkRecoveryProgress } from './chat-network-recovery.mjs';
import { scheduleDraftPhoneProgress } from './schedule-draft-phone.mjs';
import { consentRestartPhoneProgress } from './consent-restart-phone.mjs';
import { teamConnectionRecoveryProgress } from './team-connection-recovery.mjs';

export const currentProgress = [
  teamConnectionRecoveryProgress,
  consentRestartPhoneProgress,
  scheduleDraftPhoneProgress,
  chatNetworkRecoveryProgress,
  { date: '2026-10-27', title: 'Un essai complet s’arrête avant la coupure',
    text: 'Lors de cet essai, une capture de confirmation échoue et la coupure réseau ne démarre pas. Les dix essais séparés passent en simulation.',
    flow: 'native-startup', coversFlows: ['messages', 'team-conversation'],
    source: 'docs/release/evidence/render-network-gate-48ea950-2026-10-27/README.md' },
  tripDraftPhoneProgress,
];
