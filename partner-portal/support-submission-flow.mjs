const base = 'docs/release/evidence/support-submission-recovery-2026-10-22/';
const phone = 'docs/release/evidence/support-recovery-phone-attempt-2026-10-22/';
export function createSupportSubmissionFlow(shot) {
  return { id: 'support-submission', title: 'Reprendre une demande de support', status: 'partial', checkedAt: '2026-10-22', latestEvidence: 'phone',
    summary: 'La coupure garde le texte ; la reprise reste à vérifier.',
    verified: 'Sur téléphone, le texte et Urgent restent visibles sans confirmation. Une seule demande est retrouvée après reconnexion. Deux tentatives ont été reçues : l’origine de la seconde reste à expliquer.',
    remaining: 'Expliquer la seconde tentative, puis terminer la reprise après fermeture sur téléphone réel. La vidéo locale utilise une confirmation simulée.',
    submissionRecovery: { source: base + 'summary.json', checksums: base + 'artifact-sha256.json', checkedAt: '2026-10-22' },
    submissionPhoneAttempt: { source: phone + 'summary.json', checksums: phone + 'artifact-sha256.json', checkedAt: '2026-10-22' },
    clips: ['support-submission-retry'],
    images: [shot('support-recovery-phone-prepared', 'Demande et choix Urgent, essai sur téléphone du 22 octobre'),
      shot('support-recovery-phone-unconfirmed', 'Envoi non confirmé après coupure, essai sur téléphone du 22 octobre'),
      shot('support-recovery-phone-history', 'Une demande retrouvée après reconnexion, essai sur téléphone du 22 octobre'),
      shot('support-recovery-phone-details', 'Texte et choix Urgent enregistrés, essai sur téléphone du 22 octobre'),
      shot('support-submission-unconfirmed', 'Envoi non confirmé, essai local du 22 octobre'),
      shot('support-submission-restored', 'Texte et choix Urgent retrouvés, essai local du 22 octobre'),
      shot('support-submission-confirmed', 'Confirmation après un nouvel essai, essai local du 22 octobre'),
      shot('support-submission-storage-error', 'Envoi bloqué si la demande ne peut pas être retrouvée, essai local du 22 octobre')],
    source: phone + 'README.md' };
}
export function supportSubmissionSteps(image, clip) {
  return [image('support-recovery-phone-prepared', 'Préparer la demande', 'Sur téléphone : le texte est rempli et Urgent est activé.'),
    image('support-recovery-phone-unconfirmed', 'La connexion coupe', 'Le texte reste visible et le bouton propose de réessayer.'),
    image('support-recovery-phone-history', 'Retrouver la demande', 'Après reconnexion, une demande apparaît. La seconde tentative reçue reste à expliquer.'),
    image('support-recovery-phone-details', 'Lire les détails', 'Le texte et Urgent sont conservés. La reprise après fermeture reste à terminer.'),
    clip('support-submission-retry', 'Comparer avec l’essai local', 'Essai local de l’écran : la confirmation est simulée. Le service est vérifié séparément.'),
    image('support-submission-unconfirmed', 'Garder la demande', 'Sans confirmation, le texte et le choix Urgent restent figés.'),
    image('support-submission-restored', 'Retrouver l’envoi en attente', 'La réouverture de l’écran retrouve la même demande. Aucun envoi ne repart tout seul.'),
    image('support-submission-confirmed', 'Réessayer', 'La confirmation permet de préparer une nouvelle demande.'),
    image('support-submission-storage-error', 'Ne pas perdre un envoi', 'Si l’envoi en attente ne peut pas être lu, le formulaire reste bloqué.')];
}
