const source = 'docs/release/evidence/location-freshness-2026-10-19/';
import {trackingPhoneAttempt, trackingAttemptImages} from './tracking-phone-attempt.mjs';

export function createTrackingFlow() {
  return { id: 'tracking', title: 'Sécurité enfant et suivi de trajet', status: 'blocked', checkedAt: '2026-10-25', latestEvidence: 'phone',
    summary: 'Un écart d’horloge bloque le suivi sur téléphone.',
    verified: 'Un premier point est reçu. Le déplacement simulé n’arrive pas ; l’app signale une position ancienne. Données de test, aucun trajet réel.',
    remaining: 'Corriger les horloges, terminer l’affichage en direct et rejouer la reprise. Restent compte enfant, consentement, prise en charge, dépose, arrière-plan, verrouillage, pertes GPS/réseau, redémarrage, batterie et alertes de position.',
    trackingPhoneAttempt, images: trackingAttemptImages, source: source + 'README.md' };
}
