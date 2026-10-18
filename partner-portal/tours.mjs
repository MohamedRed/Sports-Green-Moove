const image = (file, title, text) => ({ image: file, title, text });
const clip = (file, title, text) => ({ clip: file, title, text });

export const tours = {
  'emergency-contact': [
    image('emergency-editor-narrow', 'Choisir son contact', 'L’écran garde les champs et les actions accessibles avec du texte agrandi, dans l’essai simulé.'),
    image('emergency-editor-changed', 'Si le téléphone ne s’ouvre pas', 'Le nouveau numéro reste visible avec le message d’erreur. L’ouverture réelle du téléphone reste à tester.'),
  ],
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
    image('phone-session-restored', 'Rouvrir l’app', 'Sur téléphone, le parent retrouve l’accueil sans se reconnecter après fermeture complète.'),
    image('local-home', 'Consulter l’accueil', 'Le trajet de test apparaît dans l’accueil.'),
    image('local-calendar', 'Consulter le calendrier', 'Le calendrier affiche le mois de l’essai et permet de changer de mois.'),
  ],
  search: [
    image('phone-child-two-seats-consent', 'Choisir l’enfant et les places', 'Sur téléphone, l’enfant de test et deux places sont sélectionnés. La réservation complète reste à tester.'),
    image('phone-child-consent-reset', 'Changer de choix', 'Le consentement est remis à zéro quand le choix d’enfant change.'),
    image('phone-child-incomplete-search', 'Renseigner les adresses', 'Sans départ ni destination choisis, la recherche est bloquée et aucune réservation n’est créée.'),
    image('search-options-retained', 'Retrouver ses choix', 'Les options restent sélectionnées au retour dans la recherche simulée.'),
    image('search-options-invalidated', 'Modifier sa recherche', 'Les anciens résultats sont retirés après modification. Une recherche complète reste à vérifier.'),
  ],
  publication: [
    image('trip-framed-places-selected', 'Choisir les nouvelles adresses', 'Les deux adresses sont retrouvées dans le nouvel essai local.'),
    image('trip-consent-first', 'Recueillir un premier accord', 'Dans l’essai du 17 octobre, un parent confirme le changement. Le second accord reste attendu.'),
    image('trip-consent-confirmed', 'Recueillir les deux accords', 'Les deux confirmations sont visibles dans l’essai du 17 octobre. Elles passent aussi dans le nouvel essai.'),
    image('trip-framed-map-visible', 'Vérifier la carte', 'Les deux repères sont entièrement visibles dans le nouvel essai local du 18 octobre.'),
    image('trip-framed-route-applied', 'Appliquer le nouveau parcours', 'Après les deux accords, le conducteur applique le parcours. À rejouer sur téléphone, sans paiement dans cet essai.'),
    image('trip-consent-refused', 'Si un parent refuse', 'Autre cas testé : le refus conserve la réservation et le trajet initial.'),
    image('trip-consent-withdrawn', 'Si le conducteur retire sa proposition', 'Autre cas testé : le changement est retiré sans annuler les réservations.'),
  ],
  booking: [
    image('phone-booking-requested', 'Demander une place', 'Sur téléphone, le parent retrouve sa demande. Cet essai utilise des données de test et un trajet gratuit.'),
    image('phone-booking-approved', 'Retrouver l’accord', 'Après actualisation, la réservation est approuvée. L’acceptation depuis le téléphone du conducteur reste à tester.'),
    image('phone-booking-cancelled', 'Annuler la réservation', 'Le parent confirme l’annulation depuis son téléphone. La place est à nouveau disponible. Aucun paiement.'),
  ],
  messages: [
    image('chat-reservation', 'Choisir la réservation', 'Le parent choisit la réservation depuis laquelle écrire au conducteur.'),
    image('chat-empty', 'Ouvrir la conversation', 'L’échange est prêt à recevoir le premier message.'),
    image('chat-received', 'Échanger avec le conducteur', 'Le premier message et la réponse sont visibles dans l’app en local.'),
    image('chat-history', 'Retrouver un ancien échange', 'Un autre cas de l’essai vérifie l’accès à l’historique.'),
  ],
  clubs: [
    image('guardian-parent-requested', 'Demander la vérification', 'Le parent choisit son enfant et son club. La demande apparaît en attente, dans l’essai local.'),
    image('guardian-parent-verified', 'Voir la réponse du responsable', 'Après l’accord du responsable, le parent retrouve le statut vérifié dans l’app.'),
    image('guardian-parent-restored', 'Retrouver la demande', 'Le statut revient après réouverture de l’écran. La fermeture complète de l’app reste à tester.'),
    image('guardian-parent-revoked', 'Voir le retrait de la vérification', 'Le retrait est visible et une nouvelle demande peut être proposée.'),
    image('guardian-parent-other-account', 'Changer de compte', 'L’autre compte ne retrouve ni la demande ni le nom de l’enfant précédent.'),
    image('guardian-review-confirmation', 'Confirmer le lien parent-enfant', 'Dans l’espace de gestion local, le responsable confirme le parent et l’enfant concernés.'),
    image('guardian-review-verified', 'Retrouver le parent vérifié', 'Dans un essai séparé de l’espace de gestion, le résultat est visible après confirmation.'),
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
