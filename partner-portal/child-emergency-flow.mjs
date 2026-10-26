import { childAccountPhoneAttempt } from './child-account-phone-attempt.mjs';
import { childPhoneStartupAttempt } from './progress-2026-10-26.mjs';
const source = 'docs/release/evidence/child-contact-heading-pass-2026-10-19/';

export function createChildEmergencyFlow() {
  return { id: 'child-emergency', title: 'Contact d’urgence côté enfant', status: 'partial', checkedAt: '2026-10-26',
    latestEvidence: 'phone',
    summary: 'L’enfant se connecte et demande un code sur téléphone. L’accord du parent reste à refaire.',
    verified: 'Le parent retrouve son enfant sur téléphone. En local, l’enfant retrouve aussi le contact choisi par son parent pendant le trajet.',
    remaining: 'Terminer l’accord du parent et la création du compte, puis tester le trajet de l’enfant, l’accès sans localisation sur téléphone et l’ouverture réelle du téléphone.',
    phoneAttempt: childAccountPhoneAttempt,
    phoneStartup: childPhoneStartupAttempt,
    contactDiscovery: { source: 'docs/release/evidence/child-contact-discovery-2026-10-26/results.json',
      checksums: 'docs/release/evidence/child-contact-discovery-2026-10-26/artifact-sha256.json', checkedAt: '2026-10-26' },
    accountApproval: { source: 'docs/release/evidence/child-account-approval-2026-10-26/results.json',
      checksums: 'docs/release/evidence/child-account-approval-2026-10-26/artifact-sha256.json', checkedAt: '2026-10-26' },
    ui: { source: source + 'results.json', checkedAt: '2026-10-19', groups: ['child-contact-components'] },
    images: [
      { file: 'child-link-phone-entry', alt: 'Demande de code côté enfant sur téléphone, avant création du code, le 26 octobre' },
      { file: 'child-link-phone-review', alt: 'Lina sélectionnée par son parent sur téléphone, avant saisie du code et avant accord, le 26 octobre' },
      { file: 'child-contact-narrow', alt: 'Titre complet et contact sur petit écran avec grand texte, essai simulé du 19 octobre' },
      { file: 'child-contact-denied', alt: 'Contact masqué après un refus simulé, essai d’écran du 19 octobre' },
      { file: 'child-contact-changed', alt: 'Numéro modifié et téléphone indisponible simulés, essai d’écran du 19 octobre', landscape: true },
    ], source: source + 'README.md' };
}
