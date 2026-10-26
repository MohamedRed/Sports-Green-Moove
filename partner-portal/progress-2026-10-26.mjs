import { childAccountPhoneProgress } from './child-account-phone-attempt.mjs';
const folder = 'docs/release/evidence/flow-check-recovery-2026-10-26/';
export const childPhoneStartupAttempt = {
  source: folder + 'README.md', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-26',
};
export const october26Progress = [
  { date: '2026-10-26', title: 'Le contact reste accessible sans localisation en simulation',
    text: 'Neuf essais d’écran enfant passent. Le parcours complet sur téléphone reste à terminer.',
    flow: 'child-emergency', source: 'docs/release/evidence/child-contact-discovery-ui-2026-10-26/README.md' },
  { date: '2026-10-26', title: 'L’enfant retrouve son contact pendant le trajet en local',
    text: 'Le lien avec son profil est corrigé. Les contrôles d’accès passent ; le parcours sur téléphone reste à terminer.',
    flow: 'child-emergency', source: 'docs/release/evidence/child-contact-discovery-2026-10-26/README.md' },
  { date: '2026-10-26', title: 'Le nouvel essai enfant s’arrête avant la connexion',
    text: 'L’installation reste bloquée. Aucun accord validé ; les deux captures précédentes restent disponibles.',
    flow: 'child-emergency', source: folder + 'README.md' },
  childAccountPhoneProgress,
  { date: '2026-10-26', title: 'Le parent peut lier le compte enfant en local',
    text: 'Dix contrôles passent. L’accès au contact sans localisation est ajouté ; les essais sur téléphone restent à faire.',
    flow: 'child-emergency', source: 'docs/release/evidence/child-account-approval-2026-10-26/README.md' },
];
