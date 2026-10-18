const image = (file, title, text) => ({ image: file, title, text });
const clip = (file, title, text) => ({ clip: file, title, text });

export const tours = {
  'auth-validation': [
    image('login-empty', 'Renseigner l’adresse e-mail', 'Le formulaire signale une adresse manquante.'),
    image('signup-name', 'Renseigner le nom', 'La création du compte demande un nom.'),
    image('signup-email', 'Vérifier l’adresse', 'Une adresse mal formée est refusée.'),
    image('signup-short', 'Choisir le mot de passe', 'Un mot de passe trop court est refusé. La création du compte reste à retester.'),
  ],
  signout: [
    clip('signout-action', 'Se déconnecter', 'La vidéo montre le retour à l’écran de connexion.'),
    clip('signed-out-relaunch', 'Relancer l’app', 'Après fermeture et relancement, la connexion est à nouveau demandée.'),
  ],
  navigation: [
    image('local-home', 'Consulter l’accueil', 'Le trajet de test apparaît dans l’accueil.'),
    image('local-calendar', 'Consulter le calendrier', 'Le calendrier affiche le mois de l’essai et permet de changer de mois.'),
  ],
  search: [
    image('search-options-retained', 'Retrouver ses choix', 'Les options restent sélectionnées au retour dans la recherche simulée.'),
    image('search-options-invalidated', 'Modifier sa recherche', 'Les anciens résultats sont retirés après modification. Une recherche complète reste à vérifier.'),
  ],
  publication: [
    image('trip-consent-first', 'Recueillir un premier accord', 'Un parent confirme le changement. Le second accord reste attendu.'),
    image('trip-consent-confirmed', 'Recueillir les deux accords', 'Les deux confirmations sont enregistrées dans cet essai local.'),
    image('trip-consent-refused', 'Si un parent refuse', 'Autre cas testé : le refus conserve la réservation et le trajet initial.'),
    image('trip-consent-withdrawn', 'Si le conducteur retire sa proposition', 'Autre cas testé : le changement est retiré sans annuler les réservations.'),
  ],
  booking: [
    image('booking-retry-unconfirmed', 'Vérifier une demande sans réponse', 'Après une réponse perdue, le parent peut renvoyer sa demande.'),
    image('booking-retry-confirmed', 'Retrouver la confirmation', 'Le renvoi retrouve une seule demande enregistrée dans cet essai local.'),
  ],
  messages: [
    image('chat-reservation', 'Choisir la réservation', 'Le parent choisit la réservation depuis laquelle écrire au conducteur.'),
    image('chat-empty', 'Ouvrir la conversation', 'L’échange est prêt à recevoir le premier message.'),
    image('chat-received', 'Échanger avec le conducteur', 'Le premier message et la réponse sont visibles dans l’app en local.'),
    image('chat-history', 'Retrouver un ancien échange', 'Un autre cas de l’essai vérifie l’accès à l’historique.'),
  ],
  clubs: [
    image('membership-manager', 'Examiner les adhésions', 'Le responsable du club accepte ou refuse les demandes dans son espace.'),
    image('membership-parent', 'Voir la décision dans l’app', 'Le parent retrouve les acceptations et les refus.'),
    image('membership-reopened', 'Revenir aux adhésions', 'Les décisions restent visibles après réouverture de l’écran.'),
  ],
  'ride-lifecycle': [
    image('ride-delivered', 'Déposer les passagers', 'L’essai local vérifie les déposes avant la fin du trajet.'),
    image('ride-history', 'Retrouver le trajet terminé', 'Le trajet terminé apparaît dans l’historique du parent.'),
  ],
  ratings: [
    image('ride-review', 'Donner son avis', 'Une demande d’avis est proposée après le trajet local.'),
    image('ride-review-sent', 'Envoyer l’avis', 'L’avis est enregistré et la demande disparaît.'),
  ],
  impact: [
    image('ride-impact', 'Consulter son impact', 'L’écran présente l’impact du trajet terminé lors de l’essai local.'),
    image('ride-rewards', 'Consulter ses récompenses', 'Le solde et la récompense du trajet de test sont visibles.'),
  ],
};
