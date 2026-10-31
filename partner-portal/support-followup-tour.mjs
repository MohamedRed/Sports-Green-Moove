export function supportFollowupSteps(image) {
  return [
    image('support-followup-phone-inbox-received', 'Retrouver sa demande', 'La demande envoyée depuis le téléphone apparaît avec le statut Reçue.'),
    image('support-followup-phone-awaiting', 'Lire sa demande', 'Le texte envoyé est conservé. Aucune réponse n’est encore affichée.'),
    image('support-followup-phone-answered', 'Recevoir une réponse', 'Après actualisation, la première réponse apparaît avec le statut En cours.'),
    image('support-followup-phone-closed', 'Retrouver la clôture', 'Le statut passe à Clôturée. Les deux réponses restent lisibles.'),
    image('support-followup-phone-reopened', 'Rouvrir l’app', 'Après réouverture, la même demande et ses deux réponses sont retrouvées.'),
    image('support-followup-phone-driver-profile', 'Changer de compte', 'Le même téléphone se connecte au conducteur de test.'),
    image('support-followup-phone-foreign', 'Garder sa demande privée', 'Le conducteur ne voit aucune demande du parent.'),
    image('support-followup-phone-restored-parent-profile', 'Revenir au parent', 'Le parent se reconnecte à son propre compte.'),
    image('support-followup-phone-restored', 'Retrouver son historique', 'La demande clôturée revient avec ses deux réponses, sans nouvel envoi.'),
  ];
}
