const base = 'docs/release/evidence/team-conversation-services-2026-10-21/';

export function createTeamConversationFlow() {
  return { id: 'team-conversation', title: 'Conversation d’équipe', status: 'partial', checkedAt: '2026-10-21',
    summary: 'Les accès et les messages passent en local. Les écrans restent à ajouter.',
    verified: 'Les adultes approuvés et les parents vérifiés peuvent échanger. Chacun voit uniquement les messages après son arrivée. Le retrait coupe l’accès.',
    remaining: 'Ajouter la conversation dans l’app, puis vérifier les échanges et les notifications sur téléphone.',
    local: { source: base + 'services.json', checkedAt: '2026-10-21', groups: [
      'verified-parent-joins-approved-child-team-without-earlier-history',
      'guardian-revocation-denies-read-pagination-send-and-replay',
      'second-independently-verified-parent-is-included-with-its-own-history-boundary',
      'child-token-cannot-be-bypassed-with-mixed-adult-roles',
      'adult-team-reapproval-does-not-recover-prior-history',
    ], checks: ['Un nouveau membre ne voit pas les anciens messages.',
      'Chaque parent doit avoir son propre accord du club.',
      'Les comptes enfants restent exclus.', 'Le retrait bloque aussi l’envoi et les anciennes pages.',
      'Une réinscription ne rouvre pas l’ancien historique.'] },
    images: [], source: base + 'README.md' };
}
