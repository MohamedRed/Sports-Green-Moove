const folder='docs/release/evidence/chat-pending-restart-phone-2026-10-31/';
export const chatPendingRestartPhone={source:folder+'review.json',checkedAt:'2026-10-31',checksums:folder+'artifact-sha256.json'};
const images=[['offline-unconfirmed','Le message en attente avant fermeture'],
  ['pending-restored','Le message en attente retrouvé après fermeture complète'],['confirmed','Un seul message envoyé après Réessayer']];
export const chatPendingRestartImages=images.map(([name,alt])=>({file:'chat-phone-pending-'+name,
  alt:alt+', capture de session du 31 octobre, compte de test'}));
export const chatPendingRestartCaptures=Object.fromEntries(images.map(([name])=>['chat-phone-pending-'+name,folder+'captures/'+name+'.png']));
export const chatPendingRestartTour=[
  {image:'chat-phone-pending-offline-unconfirmed',title:'Garder le message en attente',text:'La coupure laisse le texte non confirmé.'},
  {image:'chat-phone-pending-pending-restored',title:'Rouvrir après fermeture',text:'Le message revient sans être envoyé tout seul.'},
  {image:'chat-phone-pending-confirmed',title:'Confirmer l’envoi',text:'Réessayer envoie un seul message et vide le champ.'},
];
export const chatPendingRestartProgress={date:'2026-10-31',title:'Un envoi reprend après fermeture complète',
  text:'Le message en attente revient sur téléphone. Réessayer ne crée qu’un message. Trois captures ajoutées.',
  flow:'messages',source:folder+'README.md',checksums:folder+'artifact-sha256.json'};
