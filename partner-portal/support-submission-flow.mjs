const base = 'docs/release/evidence/support-submission-recovery-2026-10-22/';
const phone = 'docs/release/evidence/support-recovery-phone-attempt-2026-10-22/';
const diagnostics = 'docs/release/evidence/support-recovery-diagnostics-2026-10-22/';
const restart = 'docs/release/evidence/support-process-restart-phone-2026-10-22/';
const confirmed = 'docs/release/evidence/support-confirmed-restart-phone-2026-10-23/';
export function createSupportSubmissionFlow(shot) {
  return { id: 'support-submission', title: 'Reprendre une demande de support', status: 'partial', checkedAt: '2026-10-23', latestEvidence: 'phone',
    summary: 'La demande revient après fermeture ; réessayer ne la crée pas deux fois.',
    verified: 'Après un arrêt complet de l’app, le texte et Urgent reviennent. Réessayer confirme la même demande sans doublon. Une seconde fermeture garde le formulaire vide.',
    remaining: 'Rejouer une vraie coupure sur téléphone réel et expliquer les renvois précédents. La vidéo locale utilise une confirmation simulée.',
    submissionRecovery: { source: base + 'summary.json', checksums: base + 'artifact-sha256.json', checkedAt: '2026-10-22' },
    submissionPhoneAttempt: { source: phone + 'summary.json', checksums: phone + 'artifact-sha256.json', checkedAt: '2026-10-22' },
    submissionDiagnostics: { source: diagnostics + 'summary.json', checksums: diagnostics + 'artifact-sha256.json', checkedAt: '2026-10-22' },
    submissionRestartPhone: { source: restart + 'summary.json', checksums: restart + 'artifact-sha256.json', checkedAt: '2026-10-22' },
    submissionConfirmedRestartPhone: { source: confirmed + 'summary.json', checksums: confirmed + 'artifact-sha256.json', checkedAt: '2026-10-23' },
    clips: ['support-submission-retry'],
    images: [shot('support-confirmed-phone-prepared', 'Demande prête, essai sur téléphone du 23 octobre'),
      shot('support-confirmed-phone-pending', 'Texte et Urgent retrouvés après fermeture, essai sur téléphone du 23 octobre'),
      shot('support-confirmed-phone-confirmed', 'Même demande confirmée sans doublon, essai sur téléphone du 23 octobre'),
      shot('support-confirmed-phone-reopened', 'Formulaire vide après la seconde fermeture, essai sur téléphone du 23 octobre'),
      shot('support-restart-phone-prepared', 'Demande prête, nouvel essai sur téléphone du 22 octobre'),
      shot('support-restart-phone-uncertain', 'Sans confirmation, avant fermeture complète, essai sur téléphone du 22 octobre'),
      shot('support-restart-phone-restored', 'Texte et Urgent retrouvés sans nouvelle saisie après relancement, essai sur téléphone du 22 octobre'),
      shot('support-restart-phone-confirmed', 'Même demande confirmée après Réessayer, essai sur téléphone du 22 octobre'),
      shot('support-restart-phone-history', 'Une seule nouvelle demande dans l’historique, essai sur téléphone du 22 octobre'),
      shot('support-restart-phone-details', 'Texte et Urgent conservés dans la demande d’origine, essai sur téléphone du 22 octobre'),
      shot('support-recovery-phone-prepared', 'Demande et choix Urgent, premier essai sur téléphone du 22 octobre'),
      shot('support-recovery-phone-unconfirmed', 'Envoi non confirmé après coupure, essai sur téléphone du 22 octobre'),
      shot('support-recovery-phone-history', 'Une demande retrouvée après reconnexion, essai sur téléphone du 22 octobre'),
      shot('support-recovery-phone-details', 'Texte et choix Urgent enregistrés, essai sur téléphone du 22 octobre'),
      shot('support-submission-unconfirmed', 'Envoi non confirmé, essai local du 22 octobre'),
      shot('support-submission-restored', 'Texte et choix Urgent retrouvés, essai local du 22 octobre'),
      shot('support-submission-confirmed', 'Confirmation après un nouvel essai, essai local du 22 octobre'),
      shot('support-submission-storage-error', 'Envoi bloqué si la demande ne peut pas être retrouvée, essai local du 22 octobre')],
    source: confirmed + 'README.md' };
}
export function supportSubmissionSteps(image, clip) {
  return [image('support-confirmed-phone-prepared', 'Préparer la demande', 'Le texte est rempli et Urgent est activé.'),
    image('support-confirmed-phone-pending', 'Retrouver le brouillon', 'Après fermeture complète, le texte et Urgent reviennent sans les retaper. Le téléphone n’a pas été mis hors ligne.'),
    image('support-confirmed-phone-confirmed', 'Confirmer une seule demande', 'Réessayer confirme la demande d’origine, sans doublon.'),
    image('support-confirmed-phone-reopened', 'Rouvrir après confirmation', 'Après une seconde fermeture complète, aucun brouillon ne revient. La demande reste enregistrée.'),
    image('support-restart-phone-prepared', 'Revoir l’essai du 22 octobre', 'Cet essai précédent reste séparé de celui du 23 octobre.'),
    image('support-restart-phone-uncertain', 'Rester sans confirmation', 'La réponse est retenue pendant cet essai. Le téléphone reste connecté.'),
    image('support-restart-phone-restored', 'Fermer puis retrouver la demande', 'Après un arrêt complet de l’app, le texte et Urgent reviennent sans les retaper.'),
    image('support-restart-phone-confirmed', 'Réessayer une fois', 'La demande d’origine est confirmée. Aucun doublon n’est créé.'),
    image('support-restart-phone-history', 'Retrouver la demande', 'Une seule nouvelle demande apparaît à côté de celle déjà présente avant l’essai.'),
    image('support-restart-phone-details', 'Lire les détails', 'Le texte et le choix Urgent sont conservés.'),
    clip('support-submission-retry', 'Comparer avec l’essai local', 'Essai local de l’écran : la confirmation est simulée. Le service est vérifié séparément.'),
    image('support-submission-unconfirmed', 'Garder la demande', 'Sans confirmation, le texte et le choix Urgent restent figés.'),
    image('support-submission-restored', 'Retrouver l’envoi en attente', 'La réouverture de l’écran retrouve la même demande. Aucun envoi ne repart tout seul.'),
    image('support-submission-confirmed', 'Réessayer', 'La confirmation permet de préparer une nouvelle demande.'),
    image('support-submission-storage-error', 'Ne pas perdre un envoi', 'Si l’envoi en attente ne peut pas être lu, le formulaire reste bloqué.')];
}
