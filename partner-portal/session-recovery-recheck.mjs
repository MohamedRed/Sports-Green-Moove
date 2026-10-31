const folder = 'docs/release/evidence/session-recovery-89fda8c-2026-10-31/';
export const sessionRecoveryRecheck = {source:folder + 'restoration/session-restoration-results.json', checkedAt:'2026-10-31'};
export const chatOwnerDraftRecheck = {source:folder + 'chat/chat-network-recovery-results.json', checkedAt:'2026-10-31'};
export const sessionRecoveryProgress = {date:'2026-10-31', title:'Réessayer retrouve le même compte',
  text:'Le nouvel essai passe en simulation, y compris après rotation. Le précédent blocage reste à expliquer.',
  flow:'session-restoration', source:folder + 'README.md', checksums:folder + 'artifact-sha256.json'};
export const chatOwnerDraftProgress = {date:'2026-10-31', title:'Le brouillon reste dans le bon compte',
  text:'Coupure, renvoi et retour au compte parent passent en simulation. Aucun brouillon ne passe au conducteur, aucun message en double.',
  flow:'messages', source:folder + 'README.md', checksums:folder + 'artifact-sha256.json'};
export const recoveryGateProgress = {date:'2026-10-31', title:'L’essai complet reste interrompu',
  text:'La copie d’une capture bloque encore la séquence. Un essai séparé manque d’espace avant de démarrer.',
  flow:'publication', coversFlows:['messages','team-conversation','native-startup'],
  source:folder + 'README.md', checksums:folder + 'artifact-sha256.json'};
