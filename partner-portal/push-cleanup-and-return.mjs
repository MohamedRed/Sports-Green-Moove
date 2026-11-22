const cleanup='docs/release/evidence/team-push-invalidation-2026-11-01/';
const returned='docs/release/evidence/foreground-return-pass-93d9138-2026-11-01/';
export const teamPushInvalidation={source:cleanup+'review.json',checkedAt:'2026-11-01'};
export const foregroundReturnPass={source:returned+'review.json',checkedAt:'2026-11-01'};
export const pushCleanupProgress={date:'2026-11-01',title:'Le nettoyage des appareils est corrigé',
  text:'Les essais locaux passent, même après un changement de compte. Les notifications app fermée restent à tester.',
  flow:'team-conversation',source:cleanup+'README.md'};
export const foregroundReturnPassProgress={date:'2026-11-01',title:'Le retour au trajet passe le nouvel essai',
  text:'La fermeture ne bloque plus cet essai en simulation. Il reste à le confirmer sur téléphone.',
  flow:'remote-ride-stop',coversFlows:['native-startup'],source:returned+'README.md'};
