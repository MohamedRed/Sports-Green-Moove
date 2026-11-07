const folder='docs/release/evidence/chat-account-switch-phone-2026-11-01/';
export const chatAccountSwitchPhone={source:folder+'review.json',checkedAt:'2026-11-01',checksums:folder+'artifact-sha256.json'};
const images=[['driver-conversation-empty','Le conducteur ne voit pas le texte en attente du parent'],
  ['parent-pending-restored','Le parent retrouve son envoi en attente'],['parent-confirmed','Le parent envoie un seul message après son retour']];
export const chatAccountSwitchImages=images.map(([name,alt])=>({file:'chat-account-phone-'+name,
  alt:alt+', capture de session du 1er novembre, comptes de test'}));
export const chatAccountSwitchCaptures=Object.fromEntries(images.map(([name])=>['chat-account-phone-'+name,folder+'captures/'+name+'.png']));
export const chatAccountSwitchTour=[
  {image:'chat-account-phone-driver-conversation-empty',title:'Changer de compte',text:'Le texte en attente du parent reste invisible chez le conducteur.'},
  {image:'chat-account-phone-parent-pending-restored',title:'Revenir au parent',text:'Son message revient sans être envoyé tout seul.'},
  {image:'chat-account-phone-parent-confirmed',title:'Envoyer depuis le bon compte',text:'Une nouvelle tentative crée un seul message.'},
];
export const chatAccountSwitchProgress={date:'2026-11-01',title:'Le message en attente reste privé entre comptes',
  text:'Le conducteur ne le voit pas. Le parent le retrouve et l’envoie une seule fois. Trois captures ajoutées.',
  flow:'messages',source:folder+'README.md',checksums:folder+'artifact-sha256.json'};
