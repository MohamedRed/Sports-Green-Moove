import { tours } from './tours.mjs';
import {requestSafetyRecheck} from './request-safety.mjs';
import {dependencyPatchRecheck} from './dependency-patch.mjs';
import {nativeGateRecheck} from './native-gate-recheck.mjs';
import {publishedMediaReview} from './published-media-review.mjs';
import {publishedMediaPlayback} from './published-media-playback.mjs';
import {reviewHistoryRecheck} from './review-history.mjs';
import {reviewHistoryPhone, reviewHistoryPhoneImages} from './review-history-phone.mjs';
import {receivedRatingsRecheck, receivedRatingImages} from './received-ratings.mjs';
import {reviewPaginationRecheck, reviewPaginationImages} from './review-pagination.mjs';
import {reviewDisplayRecheck, reviewDisplayImage} from './review-display-recovery.mjs';
import {reviewContextRecheck, reviewTripImages, reviewBaselineGateRecheck} from './review-trip-context.mjs';
import {reviewContextPhoneAttempt, reviewContextPhoneImages} from './review-context-phone.mjs';
import { createPublicationFlow } from './publication-flow.mjs';
import { createBookingFlow } from './booking-flow.mjs';
import { chatNetworkRecovery, chatNetworkRecheck } from './chat-network-recovery.mjs';
import { createSupportFlow } from './support-flow.mjs';
import { createUrgentSupportFlow } from './urgent-support-flow.mjs';
import { createSupportSubmissionFlow } from './support-submission-flow.mjs';
import { createNavigationFlow, createSearchFlow } from './parent-phone-flows.mjs';
import { createEmergencyFlow } from './emergency-flow.mjs';
import { createChildEmergencyFlow } from './child-emergency-flow.mjs';
import { createEmergencyProfileFlow } from './emergency-profile-flow.mjs';
import { createSessionRestorationFlow } from './session-restoration-flow.mjs';
import { createSessionDisconnectFlow } from './session-disconnect-flow.mjs';
import { createNotificationSettingsFlow } from './notification-settings-flow.mjs';
import { createProfileCityFlow } from './profile-city-flow.mjs';
import { createImpactFlow } from './impact-flow.mjs';
import { createPaymentsFlow } from './payments-flow.mjs';
import { nativeVerification } from './native-verification.mjs';
import { nativeRechecks } from './native-rechecks.mjs';
export { assets, videos, excerpts } from './portal-media.mjs';
import { createTrackingFlow } from './tracking-flow.mjs';
import {createTrackingNetworkFlow} from './tracking-network-phone.mjs';
import { createRideEmergencyFlow } from './ride-emergency-flow.mjs';
import { createRideObservationFlow } from './ride-observation-flow.mjs';
import { createNativeStartupFlow } from './native-startup-flow.mjs';
import { createRemoteRideStopFlow } from './remote-ride-stop-flow.mjs';
import { createTeamEnrollmentFlow } from './team-enrollment-flow.mjs';
import { createTeamReviewFlow } from './team-review-flow.mjs';
import { createTeamConversationFlow } from './team-conversation-flow.mjs';
export { captures } from './evidence-captures.mjs';
import { recentProgress } from './recent-progress.mjs';
import { blockers } from './progress-blockers.mjs';

const manual = 'docs/release/evidence/browserstack-2026-10-11/README.md';
const replay = 'docs/release/evidence/browserstack-2026-10-13/README.md';
const validation = 'docs/release/evidence/browserstack-2026-10-15/README.md';
const localReport = 'docs/release/evidence/local-2026-10-15/README.md';
const membershipReport = 'docs/release/evidence/local-membership-review-2026-10-16/README.md';
const rideUiReport = 'docs/release/evidence/local-ride-ui-2026-10-15/README.md';
const rideUi = (groups) => ({ source: 'docs/release/evidence/local-ride-ui-2026-10-15/results.json', groups });
const uiReport = 'docs/release/evidence/local-ui-2026-10-15/README.md';
const ui = (groups, source = 'results.json') => ({ source: `docs/release/evidence/local-ui-2026-10-15/${source}`, groups });
const local = (groups, checks, source = 'docs/release/evidence/local-2026-10-15/results.json', checkedAt) =>
  ({ source, groups, checks, ...(checkedAt ? { checkedAt } : {}) });
const shot = (file, alt) => ({ file, alt });

export const content = {
  updatedAt: '2026-10-29',
  lastVerifiedAt: '2026-10-29',
  nativeClockCiRecheck: {source: 'docs/release/evidence/native-clock-ci-30e1ebe-2026-10-25/summary.json',
    checksums: 'docs/release/evidence/native-clock-ci-30e1ebe-2026-10-25/artifact-sha256.json', checkedAt: '2026-10-25'},
  ...nativeRechecks,
  requestSafetyRecheck,
  dependencyPatchRecheck,
  nativeGateRecheck,
  publishedMediaReview,
  publishedMediaPlayback,
  reviewHistoryRecheck,
  reviewHistoryPhone,
  receivedRatingsRecheck,
  reviewPaginationRecheck,
  reviewDisplayRecheck,
  reviewContextRecheck,
  reviewContextPhoneAttempt,
  reviewBaselineGateRecheck,
  boundedValidationRecheck: { source: 'docs/release/evidence/bounded-validation-2026-10-24/summary.json',
    checkedAt: '2026-10-24', checksums: 'docs/release/evidence/bounded-validation-2026-10-24/artifact-sha256.json' },
  adminClientLifecycleRecheck: { source: 'docs/release/evidence/admin-client-lifecycle-2026-10-24/results.json',
    checkedAt: '2026-10-24', checksums: 'docs/release/evidence/admin-client-lifecycle-2026-10-24/artifact-sha256.json' },
  nativeNetworkPreparationRecheck: { source: 'docs/release/evidence/native-terminal-80c88d0c-2026-10-23/run.json',
    checkedAt: '2026-10-23', checksums: 'docs/release/evidence/native-terminal-80c88d0c-2026-10-23/artifact-sha256.json' },
  nativeVerification,
  releaseNote: 'Tests en cours.',
  updates: [
    ...recentProgress,
    { date: '2026-10-16', title: 'L’échange après relancement passe en local',
      text: 'Les trois messages et la réponse du conducteur sont retrouvés. Le nouvel essai de coupure n’a pas pu démarrer.', flow: 'messages' },
    { date: '2026-10-16', title: 'La réponse après relancement reste à confirmer',
      text: 'Les messages sont retrouvés, mais le dernier essai n’a pas confirmé la réponse du conducteur. Les captures précédentes restent disponibles.', flow: 'messages' },
    { date: '2026-10-16', title: 'Les suppléments passent les essais locaux',
      text: 'Deux suppléments simulés sont enregistrés une seule fois. Les écrans et les remboursements restent à terminer.', flow: 'payments' },
    { date: '2026-10-16', title: 'Les changements confirmés s’appliquent en local',
      text: 'Horaire, parcours et prix sont mis à jour après accord. Les écrans et les paiements réels restent à terminer.', flow: 'publication' },
    { date: '2026-10-16', title: 'Premiers contrôles des confirmations',
      text: 'En local, deux parents confirment séparément. Un refus conserve le trajet initial. Les écrans et l’application des changements restent à ajouter.', flow: 'publication' },
    { date: '2026-10-16', title: 'Les parents confirmeront les changements',
      text: 'Un nouvel horaire, parcours ou prix devra être confirmé par les parents concernés. Ce parcours reste à construire et à tester.', flow: 'publication' },
    { date: '2026-10-16', title: 'Les détails réservés restent protégés',
      text: 'En local, le prix, l’horaire et le parcours ne peuvent plus être changés directement. La modification du trajet reste à construire.', flow: 'publication' },
    { date: '2026-10-16', title: 'Le conducteur peut annuler son trajet',
      text: 'Essai local réussi : deux réservations annulées et un seul avis au parent. Les captures sont disponibles.', flow: 'publication' },
    { date: '2026-10-16', title: 'Annuler un trajet ferme ses réservations',
      text: 'Les premiers contrôles locaux passent, sans doublon de réservation ni d’avis aux parents.', flow: 'publication' },
    { date: '2026-10-16', title: 'Les équipes restent dans leur club',
      text: 'En local, un responsable ne peut plus déplacer ni modifier l’équipe d’un autre club. La gestion des membres et les groupes restent à terminer.', flow: 'clubs' },
    { date: '2026-10-16', title: 'Le renvoi ne crée pas de doublon',
      text: 'Essai local repris : un seul message et une seule notification après le renvoi. Les deux captures ont été mises à jour.', flow: 'messages' },
    { date: '2026-10-16', title: 'Les messages restent après fermeture',
      text: 'En local, le parent reste connecté, retrouve ses messages puis reprend l’échange avec le conducteur. Une nouvelle capture est disponible.', flow: 'messages' },
    { date: '2026-10-16', title: 'Un groupe par équipe',
      text: 'Le groupe réunira les membres d’une équipe et les parents des enfants inscrits. Ce parcours reste à construire et à tester.', flow: 'messages' },
    { date: '2026-10-16', title: 'Les places réservées restent protégées',
      text: 'En local, un conducteur ne peut plus rendre disponibles des places déjà réservées. L’annulation les libère une seule fois.', flow: 'booking' },
    { date: '2026-10-16', title: 'Les adhésions se mettent à jour dans l’app',
      text: 'Le parent voit l’acceptation ou le refus, puis peut refaire une demande. Les adhésions restent visibles après réouverture de l’écran.', flow: 'clubs' },
    { date: '2026-10-16', title: 'Le club peut accepter ou refuser une adhésion',
      text: 'Le responsable du club et l’administrateur prennent leurs décisions en local. Les statuts et le nombre de membres sont vérifiés. Les captures sont disponibles.', flow: 'clubs' },
    { date: '2026-10-16', title: 'Refus et annulation testés dans l’app',
      text: 'En local, le parent annule deux réservations et le conducteur en refuse une. Les places et les statuts sont vérifiés. Deux captures sont disponibles.', flow: 'booking' },
    { date: '2026-10-16', title: 'Les choix restent liés à la demande',
      text: 'Dans l’essai local simulé, les options sont conservées au retour et un ancien résultat ne peut plus être réservé après modification. Deux captures sont disponibles.', flow: 'search' },
    { date: '2026-10-15', title: 'La demande reprend le nombre de places choisi',
      text: 'En local, une demande de deux places en retire deux après acceptation ; l’annulation les restitue. Les essais d’écran continuent.', flow: 'booking' },
    { date: '2026-10-15', title: 'La recherche repart à zéro pour un autre compte simulé',
      text: 'Deux essais d’écran locaux passent : lieux effacés au changement de compte simulé et ancien lieu retiré après modification. Une capture est disponible.', flow: 'search' },
    { date: '2026-10-15', title: 'La recherche ne reprend plus un ancien choix',
      text: '15 contrôles locaux passent : réponses lentes ignorées, recherche vidée à la déconnexion et doubles demandes bloquées pendant un envoi.', flow: 'search' },
    { date: '2026-10-15', title: 'Un premier message depuis une réservation',
      text: 'En local, le parent écrit et le conducteur répond. Un ancien échange est aussi retrouvé dans l’app. Les captures sont disponibles.', flow: 'messages' },
    { date: '2026-10-15', title: 'Les anciens échanges passent les contrôles locaux',
      text: '26 conversations retrouvées, même après 120 messages dans un seul échange. La vérification complète dans l’app continue.', flow: 'messages' },
    { date: '2026-10-15', title: 'Le parent et le conducteur se répondent dans l’app',
      text: 'En local : réponses reçues, brouillon conservé et anciens messages retrouvés. Les captures sont disponibles.', flow: 'messages' },
    { date: '2026-10-15', title: 'Un trajet complet, puis un avis',
      text: 'Dans l’app en local : passagers déposés, trajet terminé, historique retrouvé et avis envoyé. Les captures sont disponibles.', flow: 'ride-lifecycle' },
    { date: '2026-10-15', title: 'Le trajet ne peut plus être terminé trop tôt',
      text: 'Les contrôles locaux refusent une dépose avant la prise en charge, le mauvais passager et une fin de trajet prématurée.', flow: 'ride-lifecycle' },
    { date: '2026-10-15', title: 'Le conducteur accepte une réservation dans l’app',
      text: 'L’acceptation passe en local. Le refus et l’annulation côté parent restent à ajouter.', flow: 'booking' },
    { date: '2026-10-15', title: 'Le calendrier et l’affichage avancent',
      text: 'Les mois défilent, la connexion fonctionne en paysage et le thème est conservé après relancement.', flow: 'appearance' },
    { date: '2026-10-15', title: 'Une demande de support traitée de bout en bout',
      text: 'La demande envoyée depuis l’app a été prise en charge puis clôturée en local.', flow: 'support' },
    { date: '2026-10-15', title: 'Réservation et trajet passent en local',
      text: 'Publication, réservation, annulation, échanges et trajet complet : les essais locaux passent. À revoir sur téléphone.', flow: 'ride-lifecycle' },
    { date: '2026-10-15', title: 'La dernière place ne peut pas être attribuée deux fois',
      text: 'Deux demandes en même temps : une seule est acceptée. L’annulation rend la place disponible.', flow: 'booking' },
    { date: '2026-10-15', title: 'Les formulaires refusent les saisies incorrectes',
      text: 'Cinq vérifications réussies : champs vides, e-mail invalide et mot de passe trop court.', flow: 'auth-validation' },
    { date: '2026-10-13', title: 'La déconnexion est corrigée',
      text: 'L’app reste déconnectée, même après fermeture et relancement.', flow: 'signout' },
    { date: '2026-10-13', title: 'La navigation parent est filmée',
      text: 'Accueil, trajets, publication et messages : les vidéos sont disponibles.', flow: 'navigation' },
    { date: '2026-10-11', title: 'La recherche trouve les lieux',
      text: 'Wavre et Louvain-la-Neuve sont reconnus. Aucun trajet disponible pour tester la réservation.', flow: 'search' },
  ],
  blockers,
  flows: [
    { id: 'login', title: 'Connexion par e-mail', status: 'verified', checkedAt: '2026-10-11',
      summary: 'La connexion par e-mail fonctionne.',
      verified: 'Connexion avec le compte parent de test, puis arrivée sur l’accueil.',
      remaining: 'La connexion via un autre compte est prévue plus tard.',
      images: [shot('home', 'Accueil authentifié du compte parent de test')], source: manual },
    { id: 'auth-validation', title: 'Vérification des formulaires', status: 'verified', checkedAt: '2026-10-15',
      summary: 'Les champs vides et les saisies incorrectes sont refusés.',
      verified: 'Cinq contrôles : e-mail vide, nom manquant, e-mail invalide, mot de passe absent et mot de passe trop court.',
      remaining: 'La création d’un compte n’a pas été retestée ici.',
      images: [shot('login-empty', 'Adresse e-mail obligatoire'), shot('signup-name', 'Nom obligatoire'),
        shot('signup-email', 'Adresse e-mail invalide'), shot('signup-password', 'Mot de passe obligatoire'),
        shot('signup-short', 'Mot de passe trop court')], source: validation },
    { id: 'signout', title: 'Déconnexion et relancement', status: 'verified', checkedAt: '2026-10-13',
      summary: 'L’app reste déconnectée après relancement.',
      verified: 'Déconnexion, fermeture de l’app et relancement : retour à la connexion.',
      remaining: 'Tester séparément le redémarrage pendant un trajet.',
      images: [shot('signed-out', 'Écran de connexion après relancement')],
      clips: ['signout-action', 'signed-out-relaunch'], recording: 'signout', source: replay },
    createSessionRestorationFlow(),
    createSessionDisconnectFlow(),
    createNotificationSettingsFlow(),
    createNavigationFlow(),
    createSearchFlow(),
    createPublicationFlow(local, shot),
    createBookingFlow(local, shot),
    createTeamConversationFlow(),
    { id: 'messages', title: 'Messages et notifications', status: 'partial', checkedAt: '2026-10-28',
      summary: 'Le brouillon reste présent après une coupure et le renvoi ne crée pas de doublon, en simulation.',
      verified: 'Le nouvel essai du 28 octobre confirme le renvoi unique et la réponse. Les captures affichées datent du 27 octobre ou des essais précédents.',
      remaining: 'Rejouer le clavier. Répéter les essais de coupure sur téléphones, vérifier les groupes, les brouillons après fermeture et les coupures réelles pendant l’envoi. Pas encore en ligne.',
      networkRecovery: chatNetworkRecovery,
      networkRecoveryRecheck: chatNetworkRecheck,
      local: { ...local(['messages-notifications', 'chat-delivery-safety', 'chat-directory-safety', 'chat-post-commit-response-loss'], [
        'Le parent et le conducteur échangent des messages.',
        'Après une confirmation perdue, deux renvois gardent un seul message et une seule notification.',
        'La lecture est enregistrée sans effacer un message reçu plus tard.',
        'Une personne extérieure ne peut pas ouvrir la conversation ni y répondre.',
        'Les contrôles retrouvent 26 conversations malgré 120 messages dans un seul échange.',
        'Lire les 50 derniers messages laisse les 70 plus anciens comptés comme non lus.',
      ], 'docs/release/evidence/local-booking-recovery-2026-10-17/services.json'), checkedAt: '2026-10-17' },
      ui: { source: 'docs/release/evidence/native-matrix-67ab59c-2026-10-19/replay/results.json', checkedAt: '2026-10-19', groups: ['chat-conversation-ui', 'chat-directory-ui', 'chat-network-recovery-ui', 'chat-account-switch-ui', 'chat-confirmed-process-restart-ui', 'chat-post-commit-response-loss-ui'] },
      images: [shot('chat-network-isolated-draft', 'Brouillon conservé pendant la coupure, simulation du 27 octobre'),
        shot('chat-network-isolated-reply', 'Message renvoyé et réponse reçue, simulation du 27 octobre'),
        shot('chat-network-current-draft', 'Brouillon conservé pendant la coupure, essai local du 17 octobre'),
        shot('chat-network-current-reply', 'Message renvoyé et réponse reçue, essai local du 17 octobre'),
        shot('chat-restart-recheck-reply', 'Échange après relancement revérifié en local le 16 octobre'),
        shot('chat-loss-confirmed', 'Un seul message enregistré après les renvois, essai local du 16 octobre'),
        shot('chat-loss-rejected-retry', 'Message prêt à être renvoyé après une erreur, essai local du 16 octobre'),
        shot('chat-restart-reply', 'Échange réussi lors d’un essai précédent du 16 octobre'),
        shot('chat-network-reply', 'Message renvoyé et réponse reçue après la coupure, essai local du 16 octobre'),
        shot('chat-network-draft', 'Brouillon conservé pendant la coupure, essai local du 16 octobre'),
        shot('chat-picker-recovered', 'Réservations acceptées, refusées et annulées visibles, essai local du 16 octobre'),
        shot('chat-reservation', 'Réservation choisie pour le premier message, essai du 15 octobre'),
        shot('chat-empty', 'Conversation avant le premier message, essai du 15 octobre'),
        shot('chat-received', 'Premier message et réponse du conducteur, essai du 15 octobre'),
        shot('chat-history', 'Ancien échange retrouvé dans l’app, essai du 15 octobre'),
        shot('chat-landscape', 'Brouillon conservé en paysage, essai du 15 octobre')], source: 'docs/release/evidence/native-matrix-67ab59c-2026-10-19/README.md' },
    createTeamEnrollmentFlow(),
    createTeamReviewFlow(),
    { id: 'clubs', title: 'Clubs et adhésion', status: 'partial', checkedAt: '2026-10-18',
      summary: 'La demande, la réponse et le retrait du lien parent-enfant passent dans l’app, en local.',
      verified: 'Le parent demande la vérification, retrouve l’accord après réouverture de l’écran et voit son retrait. L’autre compte ne retrouve pas ces données. Les captures sont ajoutées.',
      remaining: 'Tester la fermeture complète de l’app et les droits des parents sur téléphone. Terminer les conversations d’équipe des enfants. Pas encore en ligne.',
      local: { ...local(['club-request', 'membership-review', 'team-ownership'], ['La demande est enregistrée sans doublon.', 'Un responsable extérieur au club ne peut pas décider.', 'Deux décisions simultanées ne comptent pas deux fois.', 'Un ancien choix est refusé après une nouvelle demande.', 'Un responsable ne peut pas déplacer ni modifier l’équipe d’un autre club.'], 'docs/release/evidence/local-team-ownership-2026-10-16/services.json'), checkedAt: '2026-10-16' },
      ui: { source: 'docs/release/evidence/local-guardian-parent-native-2026-10-18/guardian-parent-results.json', groups: ['guardian-parent-ui'] },
      images: [shot('guardian-parent-requested', 'Demande de vérification en attente, essai local du 18 octobre'),
        shot('guardian-parent-verified', 'Parent vérifié après décision du responsable, essai local du 18 octobre'),
        shot('guardian-parent-restored', 'Statut retrouvé après réouverture de l’écran, essai local du 18 octobre'),
        shot('guardian-parent-revoked', 'Vérification retirée, essai local du 18 octobre'),
        shot('guardian-parent-other-account', 'Autre compte sans les données précédentes, essai local du 18 octobre'),
        { ...shot('guardian-review-desktop', 'Vérifications dans l’espace de gestion, essai local du 18 octobre'), landscape: true },
        shot('guardian-review-confirmation', 'Confirmation du lien parent-enfant, essai local du 18 octobre'),
        shot('guardian-review-verified', 'Parent vérifié après confirmation, essai local du 18 octobre'),
        shot('membership-parent', 'Acceptation et refus des adhésions, essai du 16 octobre'),
        shot('membership-reopened', 'Adhésions conservées après réouverture, essai du 16 octobre'),
        shot('membership-account', 'Autre compte : clubs à rejoindre, essai du 16 octobre'),
        { ...shot('membership-manager', 'Acceptation et refus des adhésions, essai du 16 octobre'), landscape: true },
        { ...shot('membership-admin', 'Décisions d’adhésion enregistrées, essai du 16 octobre'), landscape: true },
        shot('membership-mobile', 'Confirmation annulée sans modification, essai du 16 octobre')], source: 'docs/release/evidence/local-guardian-parent-native-2026-10-18/README.md' },
    createPaymentsFlow(local, shot),
    createEmergencyFlow(),
    createEmergencyProfileFlow(),
    createChildEmergencyFlow(),
    createRideEmergencyFlow(),
    createRideObservationFlow(),
    createNativeStartupFlow(),
    createRemoteRideStopFlow(),
    createTrackingFlow(),
    createTrackingNetworkFlow(),
    { id: 'ride-lifecycle', title: 'Déroulement du trajet', status: 'partial', checkedAt: '2026-10-23',
      latestEvidence: 'phone',
      summary: 'Prise en charge, dépose et fin du trajet passent sur téléphone.',
      verified: 'Un enfant inscrit pour deux places : les confirmations restent stables, puis le parent retrouve le trajet terminé. Comptes utilisés l’un après l’autre, avec des données de test.',
      remaining: 'Restent la carte, les vraies positions, les alertes de sécurité et les essais entre téléphones.',
      ui: { ...rideUi(['ride-lifecycle-ui']), checkedAt: '2026-10-15' },
      local: local(['ride-lifecycle', 'ride-audit-ledgers', 'ride-passenger-safety'], [
        'Toutes les réservations acceptées sont incluses au départ.',
        'Un mauvais passager ou une confirmation répétée est refusé.',
        'La dépose attend la prise en charge ; la fin attend toutes les déposes.',
        'Deux départs simultanés ne créent qu’un seul trajet.',
        'Un trajet terminé ne peut plus être réservé ni redémarré.',
      ], 'docs/release/evidence/local-ride-2026-10-15/results.json', '2026-10-15'),
      images: [...['started', 'picked-up', 'dropped-off', 'stable', 'completed', 'parent-history'].map(phase => shot('ride-phone-' + phase, 'Trajet sur téléphone avec des données isolées, le 23 octobre')),
        shot('ride-delivered', 'Passagers déposés avant de terminer le trajet, en local'),
        shot('ride-history', 'Trajet terminé dans l’historique du parent, en local')], source: 'docs/release/evidence/ride-completion-recheck-2026-10-23/README.md' },
    { id: 'ratings', title: 'Avis après trajet', status: 'partial', checkedAt: '2026-10-29',
      latestEvidence: 'phone',
      summary: 'Reconnaître le trajet, donner un avis et voir sa moyenne.',
      verified: 'Nom et date affichés, puis avis du conducteur enregistré sur téléphone. Les essais précédents couvrent aussi le parent et la suite de la liste.',
      remaining: 'Revoir le trajet concerné après reconnexion, les anciens détails et la reprise après une coupure.',
      ui: { ...rideUi(['ride-review-ui']), checkedAt: '2026-10-15' },
      local: local(['ratings'], ['L’avis du parent est enregistré.', 'Le même avis ne peut pas être envoyé deux fois.', 'La demande d’avis disparaît après envoi.', 'Une personne extérieure ne peut pas noter ce trajet.'], 'docs/release/evidence/local-2026-10-15/results.json', '2026-10-15'),
      images: [...reviewContextPhoneImages, ...reviewTripImages, reviewDisplayImage, ...reviewPaginationImages, ...receivedRatingImages, ...reviewHistoryPhoneImages, shot('ride-phone-review-prompt', 'Demande d’avis sur téléphone le 23 octobre'), shot('ride-phone-reviewed', 'Avis confirmé sur téléphone le 23 octobre'),
        shot('ride-review', 'Demande d’avis après le trajet local'), shot('ride-review-sent', 'Avis envoyé et demande retirée, en local')], source: 'docs/release/evidence/review-context-phone-attempt-2026-10-29/README.md' },
    createImpactFlow(local, rideUi, shot),
    createSupportFlow(local, ui, shot),
    createProfileCityFlow(),
    createUrgentSupportFlow(shot),
    createSupportSubmissionFlow(shot),
    { id: 'appearance', title: 'Affichage et thème sombre', status: 'partial', checkedAt: '2026-10-15',
      summary: 'La connexion passe en paysage et le thème est conservé après relancement.',
      verified: 'Connexion en paysage et conservation du thème après fermeture complète vérifiées en local.',
      remaining: 'Revoir le contraste des textes secondaires et vérifier l’accessibilité sur téléphone.',
      ui: ui(['landscape-login-ui', 'theme-process-restart-ui']),
      images: [shot('local-landscape', 'Formulaire de connexion en paysage, après défilement'),
        shot('local-theme', 'Thème sombre conservé après relancement complet')], source: uiReport },
    { id: 'social-auth', title: 'Connexion via un autre compte', status: 'deferred',
      summary: 'Prévue après la connexion par e-mail.',
      verified: 'Pas encore testé.',
      remaining: 'Activer cette connexion, puis tester l’accès au compte.', images: [], source: 'docs/release/evidence-manifest.json' },
  ],
};

for (const flow of content.flows) if (tours[flow.id]) flow.tour = tours[flow.id];
