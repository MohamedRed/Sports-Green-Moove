const base = 'docs/release/evidence/support-submission-recovery-2026-10-22/';
export function createSupportSubmissionFlow(shot) {
  return { id: 'support-submission', title: 'Reprendre une demande de support', status: 'partial', checkedAt: '2026-10-22', latestEvidence: 'local',
    summary: 'Un envoi non confirmé est conservé pour pouvoir réessayer.',
    verified: 'En local : le nouvel essai garde la même demande, sans doublon. Le texte et le choix Urgent restent conservés. Les autres comptes ne voient pas cet envoi.',
    remaining: 'À vérifier sur téléphone réel, avec une vraie coupure. L’écran utilise ici une confirmation simulée ; le service a été testé séparément.',
    submissionRecovery: { source: base + 'summary.json', checksums: base + 'artifact-sha256.json', checkedAt: '2026-10-22' },
    clips: ['support-submission-retry'],
    images: [shot('support-submission-unconfirmed', 'Envoi non confirmé, essai local du 22 octobre'),
      shot('support-submission-restored', 'Texte et choix Urgent retrouvés, essai local du 22 octobre'),
      shot('support-submission-confirmed', 'Confirmation après un nouvel essai, essai local du 22 octobre'),
      shot('support-submission-storage-error', 'Envoi bloqué si la demande ne peut pas être retrouvée, essai local du 22 octobre')],
    source: base + 'README.md' };
}
export function supportSubmissionSteps(image, clip) {
  return [clip('support-submission-retry', 'Reprendre l’envoi', 'Essai local de l’écran : la confirmation est simulée. Le service est vérifié séparément.'),
    image('support-submission-unconfirmed', 'Garder la demande', 'Sans confirmation, le texte et le choix Urgent restent figés.'),
    image('support-submission-restored', 'Retrouver l’envoi en attente', 'La réouverture de l’écran retrouve la même demande. Aucun envoi ne repart tout seul.'),
    image('support-submission-confirmed', 'Réessayer', 'La confirmation permet de préparer une nouvelle demande.'),
    image('support-submission-storage-error', 'Ne pas perdre un envoi', 'Si l’envoi en attente ne peut pas être lu, le formulaire reste bloqué.')];
}
