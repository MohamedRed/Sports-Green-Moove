import {trackingPhoneAttempt} from './tracking-phone-attempt.mjs';
import {trackingClockReplay, trackingClockImages} from './tracking-clock-replay.mjs';

export function createTrackingFlow() {
  return { id: 'tracking', title: 'Sécurité enfant et suivi de trajet', status: 'partial', checkedAt: '2026-10-25', latestEvidence: 'phone',
    summary: 'Les positions avancent, même hors de l’app.',
    verified: 'Sur téléphone : déplacements simulés reçus, suivi en arrière-plan et arrêt des envois après déconnexion. Données de test, aucun trajet réel.',
    remaining: 'Vérifier l’affichage en direct sur la carte pendant un vrai déplacement. Restent compte enfant, consentement, prise en charge, dépose, verrouillage, pertes GPS/réseau, redémarrage, batterie et alertes de position.',
    trackingPhoneAttempt, trackingClockReplay, images: trackingClockImages,
    source: 'docs/release/evidence/tracking-clock-replay-2026-10-25/README.md' };
}
