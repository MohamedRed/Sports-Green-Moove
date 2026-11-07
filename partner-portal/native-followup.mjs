const folder = 'docs/release/evidence/native-followup-9bb6346-2026-10-30/';
export const teamNativeRecheck = {source: folder + 'team/team-conversation-results.json', checkedAt: '2026-10-30',
  checksums: folder + 'team/artifact-sha256.json'};
export const nativeFollowupProgress = {date: '2026-10-30', title: 'Les échanges passent à nouveau',
  text: 'La conversation d’équipe et la reprise du chat passent à nouveau en local. Les échanges entre téléphones restent à vérifier.',
  flow: 'team-conversation', coversFlows: ['messages'], source: folder + 'README.md'};
export const nativeFollowupGateProgress = {date: '2026-10-30', title: 'Une capture bloque encore la série complète',
  text: 'Les parcours rejoués passent, mais une capture de conversation est rejetée comme vide. La série complète reste en échec.',
  flow: 'native-startup', source: folder + 'README.md'};
