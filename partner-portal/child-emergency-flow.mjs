import { childAccountPhoneAttempt } from './child-account-phone-attempt.mjs';
import { childAccountPhonePass } from './child-account-phone-pass.mjs';
import { childInvitationPhone } from './child-invitation-phone.mjs';
import { childPhoneStartupAttempt } from './progress-2026-10-26.mjs';
const source = 'docs/release/evidence/child-contact-heading-pass-2026-10-19/';

export function createChildEmergencyFlow() {
  return { id: 'child-emergency', title: 'Contact d’urgence côté enfant', status: 'partial', checkedAt: '2026-10-26',
    latestEvidence: 'phone',
    summary: 'Le parent lie le compte enfant sur téléphone. Le parcours complet reste à terminer.',
    verified: 'Sur téléphone : invitation créée, partage ouvert puis invitation annulée. La liaison séparée du compte enfant passe aussi avec l’accord du parent et la déconnexion.',
    remaining: 'Mettre la page d’inscription en ligne. Tester le partage du lien jusqu’à l’inscription et l’accord du parent, puis le trajet enfant, l’accès sans localisation et l’ouverture réelle du téléphone.',
    phoneInvitation: childInvitationPhone,
    phonePairing: childAccountPhonePass,
    browserInvitation: { source: 'docs/release/evidence/child-invitation-browser-2026-10-26/README.md',
      checksums: 'docs/release/evidence/child-invitation-browser-2026-10-26/artifact-sha256.json', checkedAt: '2026-10-26' },
    invitationComponents: { source: 'docs/release/evidence/child-invitation-native-2026-10-26/README.md',
      checksums: 'docs/release/evidence/child-invitation-native-2026-10-26/artifact-sha256.json', checkedAt: '2026-10-26' },
    invitation: { source: 'docs/release/evidence/child-invitation-2026-10-26/README.md',
      checksums: 'docs/release/evidence/child-invitation-2026-10-26/artifact-sha256.json', checkedAt: '2026-10-26',
      recheck: { source: 'docs/release/evidence/child-invitation-2026-10-26/binding-recheck/README.md',
        checksums: 'docs/release/evidence/child-invitation-2026-10-26/binding-recheck/artifact-sha256.json' } },
    phoneAttempt: childAccountPhoneAttempt,
    phoneStartup: childPhoneStartupAttempt,
    discoveryComponents: { source: 'docs/release/evidence/child-contact-discovery-ui-2026-10-26/README.md',
      checksums: 'docs/release/evidence/child-contact-discovery-ui-2026-10-26/artifact-sha256.json', checkedAt: '2026-10-26' },
    contactDiscovery: { source: 'docs/release/evidence/child-contact-discovery-2026-10-26/results.json',
      checksums: 'docs/release/evidence/child-contact-discovery-2026-10-26/artifact-sha256.json', checkedAt: '2026-10-26',
      ciRecheck: { source: 'docs/release/evidence/child-contact-discovery-ci-2026-10-26/README.md',
        checksums: 'docs/release/evidence/child-contact-discovery-ci-2026-10-26/artifact-sha256.json', checkedAt: '2026-10-26' } },
    accountApproval: { source: 'docs/release/evidence/child-account-approval-2026-10-26/results.json',
      checksums: 'docs/release/evidence/child-account-approval-2026-10-26/artifact-sha256.json', checkedAt: '2026-10-26' },
    ui: { source: source + 'results.json', checkedAt: '2026-10-19', groups: ['child-contact-components'] },
    images: [
      { file: 'child-approved-phone', alt: 'Compte de Lina lié après l’accord du parent sur téléphone, le 26 octobre' },
      { file: 'child-invitation-created-phone', alt: 'Invitation pour Lina créée sur téléphone, le 26 octobre' },
      { file: 'child-invitation-revoked-phone', alt: 'Invitation pour Lina annulée sur téléphone, le 26 octobre' },
      { file: 'child-link-phone-entry', alt: 'Demande de code côté enfant sur téléphone, avant création du code, le 26 octobre' },
      { file: 'child-link-phone-review', alt: 'Lina sélectionnée par son parent sur téléphone, avant saisie du code et avant accord, le 26 octobre' },
      { file: 'child-contact-narrow', alt: 'Titre complet et contact sur petit écran avec grand texte, essai simulé du 19 octobre' },
      { file: 'child-contact-denied', alt: 'Contact masqué après un refus simulé, essai d’écran du 19 octobre' },
      { file: 'child-contact-changed', alt: 'Numéro modifié et téléphone indisponible simulés, essai d’écran du 19 octobre', landscape: true },
    ], source: source + 'README.md' };
}
