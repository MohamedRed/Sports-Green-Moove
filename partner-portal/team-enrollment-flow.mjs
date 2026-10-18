const source = 'docs/release/evidence/local-team-enrollment-2026-10-18/';

export function createTeamEnrollmentFlow() {
  return { id: 'team-enrollment', title: 'Inscription à une équipe', status: 'partial', checkedAt: '2026-10-18',
    summary: 'Les règles d’inscription passent 20 essais locaux. Les écrans restent à ajouter.',
    verified: 'Seul le responsable du bon club peut approuver. Le parent doit être vérifié pour inscrire son enfant.',
    remaining: 'Ajouter les écrans de demande et de réponse, puis la conversation de l’équipe. Rejouer sur téléphone.',
    local: { source: source + 'services.json', groups: [
      'adult-request-is-versioned-private-and-never-self-approved',
      'verified-parent-child-request-and-separate-team-approval-do-not-alter-guardian-or-club-records',
      'revoked-parent-authority-blocks-pending-approval-without-turning-history-into-a-grant',
      'concurrent-manager-decisions-and-stale-revisions-cannot-both-commit'],
    checks: ['Une demande ne vaut pas une approbation.', 'Un autre club ne peut pas décider.',
      'Le retrait du droit parent bloque une nouvelle approbation.', 'Deux réponses simultanées ne sont pas validées ensemble.'] },
    images: [], source: source + 'README.md' };
}
