const base = 'docs/release/evidence/team-conversation-services-2026-10-21/';
const screens = 'docs/release/evidence/team-chat-components-2026-10-21/';
const partial = 'docs/release/evidence/team-chat-native-peer-2026-10-21/';
const connected = 'docs/release/evidence/team-chat-connected-2026-10-21/';
const accessChanges = 'docs/release/evidence/team-chat-access-2026-10-21/';
const accessAttempt = 'docs/release/evidence/team-access-native-send-2026-10-21/';
const nativeAccess = 'docs/release/evidence/team-access-native-2026-10-21/';
import {teamNativeRecheck} from './native-followup.mjs';
import {teamAlertRecheck} from './team-alerts.mjs';
import {notificationInboxPhone, notificationInboxPhoneImages} from './notification-inbox-phone.mjs';
import {notificationRetryPhone, notificationRetryImages} from './notification-retry-phone.mjs';
import {teamPushRegistration,teamPushRegressions} from './team-push-registration.mjs';
import {teamPushJournal} from './team-push-journal.mjs';
import {teamPushLifecycle} from './team-push-lifecycle.mjs';
import {teamPushSignOut} from './team-push-signout.mjs';
import {teamPushSignOutConnected} from './team-push-signout-connected.mjs';
import {teamPushAlertAuthorization} from './team-push-alert.mjs';
import {teamPushNativeConsumer} from './team-push-native-consumer.mjs';
import {nativeAlertFirstRun} from './native-alert-first-run.mjs';
const historical = source => ({source, checkedAt: '2026-10-21'});

export function createTeamConversationFlow() {
  return { id: 'team-conversation', title: 'Conversation d’équipe', status: 'partial', checkedAt: '2026-11-01',
    summary: 'Les alertes arrivent et reprennent après une erreur.',
    verified: 'Arrivée, lecture, retrait d’accès et reprise après erreur simulée vérifiés sur téléphone. Les lectures restent séparées entre les comptes. Un nouvel accord ne rouvre pas l’ancien historique.',
    remaining: 'Terminer les notifications app fermée et vérifier les échanges entre téléphones.',
    latestEvidence: 'phone',
    nativeRecheck: teamNativeRecheck,
    alertServices: teamAlertRecheck,
    alertPhone: notificationInboxPhone,
    retryPhone: notificationRetryPhone,
    pushRegistration: teamPushRegistration,
    pushRegressions: teamPushRegressions,
    pushJournal: teamPushJournal,
    pushLifecycle: teamPushLifecycle,
    pushSignOut: teamPushSignOut,
    pushSignOutConnected: teamPushSignOutConnected,
    pushAlertAuthorization: teamPushAlertAuthorization,
    pushNativeConsumer: teamPushNativeConsumer,
    pushFirstNativeAttempt: nativeAlertFirstRun,
    authorityPhone: historical('docs/release/evidence/team-authority-phone-2026-10-21/results.json'),
    readPhone: historical('docs/release/evidence/team-read-phone-2026-10-21/results.json'),
    connected: historical(connected + 'team-conversation-results.json'),
    readServices: historical('docs/release/evidence/team-read-services-2026-10-21/services.json'),
    readConnected: historical('docs/release/evidence/team-read-connected-2026-10-21/team-conversation-results.json'),
    readAttempt: historical('docs/release/evidence/team-read-component-attempt-2026-10-21/results.json'),
    readComponents: historical('docs/release/evidence/team-read-components-2026-10-21/results.json'),
    accessChanges: historical(accessChanges + 'results.json'),
    accessAttempt: historical(accessAttempt + 'results.json'),
    nativeAccess: historical(nativeAccess + 'team-access-results.json'),
    draftAttempt: historical('docs/release/evidence/team-draft-pre-ui-2026-10-21/results.json'),
    draftRegression: historical('docs/release/evidence/team-draft-loss-2026-10-21/results.json'),
    draftRestart: historical('docs/release/evidence/team-draft-native-2026-10-21/team-draft-results.json'),
    draftErrorChecks: historical('docs/release/evidence/team-draft-error-capture-2026-10-21/results.json'),
    draftErrorRecovery: historical('docs/release/evidence/team-draft-error-components-2026-10-21/results.json'),
    phone: { source: 'docs/release/evidence/team-draft-phone-2026-10-21/results.json', checkedAt: '2026-10-21' },
    attempt: historical(partial + 'results.json'),
    ui: { source: screens + 'results.json', checkedAt: '2026-10-21', groups: ['team-chat-entry-and-narrow-layout',
      'team-chat-authorization-failure-hides-thread', 'team-chat-unconfirmed-send-reuses-one-intent'] },
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
    images: [
      ...notificationRetryImages,
      ...notificationInboxPhoneImages,
      ...[
      ...[
        ['initial', 'Le parent retrouve le message reçu après son admission'],
        ['revoked', 'Le retrait masque la conversation et la saisie'],
        ['renewed', 'Un nouvel accord ouvre une conversation vide'],
        ['new-message', 'Seul le nouveau message arrive'],
        ['replied', 'Le parent répond une seule fois, sans ancien historique'],
      ].map(([id, alt]) => ({ file: 'team-authority-phone-' + id,
        alt: alt + ', essai sur téléphone du 21 octobre' })),
      ...[
        ['initial-unread', 'Un message non lu pour le parent'],
        ['parent-read', 'Le parent ouvre le message reçu après son admission'],
        ['new-unread', 'Un nouveau message fait revenir le compteur'],
        ['parent-read-again', 'Le parent retrouve les deux messages reçus'],
        ['parent-sent', 'La réponse est envoyée une seule fois'],
        ['driver-unread', 'Le conducteur retrouve un message non lu'],
        ['driver-read', 'Le conducteur ouvre la réponse du parent'],
        ['parent-returned', 'Retour au parent : aucun message ne redevient non lu'],
      ].map(([id, alt]) => ({ file: 'team-read-phone-' + id,
        alt: alt + ', essai sur téléphone du 21 octobre' })),
      ...[
        ['count', 'Compteur lisible sur petit écran avec texte agrandi', false],
        ['visible', 'Conversation ouverte, seuls les messages affichés sont lus', false],
        ['error', 'Lecture non confirmée avec bouton Réessayer', true],
        ['retry', 'Après Réessayer, les cinq messages non affichés restent non lus', true],
        ['revoked', 'Conversation et saisie masquées après refus de l’accès', false],
      ].map(([id, alt, landscape]) => ({ file: 'team-read-verified-' + id,
        alt: alt + ', essai local simulé du 21 octobre', landscape })),
      ...[
        ['initial', 'Le parent ne voit que le message postérieur à son admission'],
        ['unsent', 'Brouillon saisi sans envoi'], ['reopened', 'Même brouillon retrouvé après fermeture'],
        ['sent', 'Un seul envoi, puis saisie vidée'], ['cleared', 'Brouillon toujours effacé après une nouvelle fermeture'],
        ['private-parent', 'Second brouillon privé avant changement de compte'],
        ['other-account', 'Le conducteur reçoit le message, sans le brouillon privé du parent'],
        ['returned-parent', 'Retour au parent : son second brouillon est conservé'],
      ].map(([id, alt]) => ({ file: 'team-draft-phone-' + id, alt: alt + ', essai sur téléphone du 21 octobre' })),
      { file: 'team-draft-errors-read', alt: 'Erreur de restauration avec bouton Réessayer, essai local avec panne simulée du 21 octobre' },
      { file: 'team-draft-errors-write', alt: 'Texte conservé pendant une erreur de sauvegarde, essai local avec panne simulée du 21 octobre' },
      ...[
        ['before', 'Brouillon privé saisi avant fermeture'], ['reopened', 'Même brouillon retrouvé après arrêt complet'],
        ['sent', 'Message envoyé une seule fois, champ de saisie vidé'], ['cleared', 'Brouillon toujours effacé après un second arrêt complet'],
        ['other-account', 'Autre compte connecté : aucun brouillon du parent'],
      ].map(([id, alt]) => ({ file: 'team-draft-verified-' + id, alt: alt + ', essai local réussi du 21 octobre' })),
      { file: 'team-draft-loss-before', alt: 'Brouillon privé saisi avant la fermeture, essai local du 21 octobre' },
      { file: 'team-draft-loss-reopened', alt: 'Brouillon perdu après fermeture complète, essai local échoué du 21 octobre' },
      { file: 'team-access-verified-initial', alt: 'Équipe du premier enfant ouverte dans l’essai local réussi du 21 octobre' },
      { file: 'team-access-verified-remaining', alt: 'Accès maintenu via le second enfant, avec son historique, essai local réussi du 21 octobre' },
      { file: 'team-access-verified-revoked', alt: 'Dernier accord retiré : conversation masquée, essai local réussi du 21 octobre' },
      { file: 'team-access-verified-renewed', alt: 'Nouvel accord : seuls les nouveaux messages reviennent, essai local réussi du 21 octobre' },
      { file: 'team-access-verified-other', alt: 'Message reçu et réponse dans la seconde équipe, essai local réussi du 21 octobre' },
      { file: 'team-access-verified-isolated', alt: 'Retour à la première équipe, sans messages de la seconde, essai local réussi du 21 octobre' },
      { file: 'team-access-attempt-initial', alt: 'Accès initial par le premier enfant, essai local partiel du 21 octobre' },
      { file: 'team-access-attempt-remaining', alt: 'Accès conservé via le second enfant, avec son propre historique, essai local partiel du 21 octobre' },
      { file: 'team-access-attempt-revoked', alt: 'Les deux accords retirés masquent la conversation, essai local partiel du 21 octobre' },
      { file: 'team-access-attempt-renewed', alt: 'Nouvel accord sans retour des anciens messages, essai local partiel du 21 octobre' },
      { file: 'team-chat-connected-parent', alt: 'Le parent ouvre son équipe sans les messages antérieurs à son arrivée, essai local du 21 octobre' },
      { file: 'team-chat-connected-exchange', alt: 'Message du conducteur et réponse du parent, nouvel essai local du 21 octobre' },
      { file: 'team-chat-connected-revoked', alt: 'Conversation masquée après retrait de l’accord du parent, essai local du 21 octobre' },
      { file: 'team-chat-connected-driver', alt: 'Le conducteur retrouve son échange et répond après changement de compte, essai local du 21 octobre' },
      { file: 'team-chat-native-parent', alt: 'Conversation de l’équipe ouverte dans l’app, essai local partiel du 21 octobre' },
      { file: 'team-chat-native-exchange', alt: 'Message du conducteur reçu et réponse du parent, essai local partiel du 21 octobre' },
      { file: 'team-chat-narrow', alt: 'Conversation ouverte sur petit écran avec texte agrandi, essai local simulé du 21 octobre' },
      { file: 'team-chat-unconfirmed', alt: 'Envoi non confirmé, message conservé pour réessayer, essai local simulé du 21 octobre' },
      { file: 'team-chat-confirmed', alt: 'Une seule réponse après le renvoi, essai local simulé du 21 octobre' },
      { file: 'team-chat-denied', alt: 'Conversation et saisie masquées après une erreur de vérification, essai local simulé du 21 octobre' },
      ].map(image => ({...image, checkedAt: '2026-10-21'})),
    ], source: 'docs/release/evidence/notification-retry-phone-2026-11-01/README.md' };
}
