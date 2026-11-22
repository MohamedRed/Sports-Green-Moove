import {profileLedgerProgress} from './profile-ledger-phone.mjs';
import {searchPhoneProgress} from './search-booking-phone.mjs';

export const dailyProgress = [
  ...searchPhoneProgress, ...profileLedgerProgress,
  {date: '2026-10-24', title: 'Les longs historiques sont comptés en entier',
    text: 'Un calcul limité aux 100 premières écritures est corrigé. Essai local réussi sur 257 écritures, avec changement de compte. Captures ajoutées.', flow: 'impact',
    source: 'docs/release/evidence/ledger-history-2026-10-24/README.md'},
  {date: '2026-10-24', title: 'La commission reste à choisir',
    text: 'Le « 0 € » fixe est retiré des réglages. Aucun tarif n’a été changé. Pas encore en ligne dans l’app.', flow: 'payments',
    source: 'docs/release/evidence/commission-presentation-2026-10-24/README.md'},
  {date: '2026-10-24', title: 'La ville peut être modifiée',
    text: 'En local, elle reste propre au compte et peut être supprimée. Les recherches ne changent pas. Captures ajoutées.', flow: 'profile-city',
    source: 'docs/release/evidence/profile-city-2026-10-24/README.md'},
  {date: '2026-10-24', title: 'L’essai complet se termine correctement',
    text: 'Les 37 étapes et les dix essais séparés passent, captures et fermeture comprises. Le suivi réel reste à vérifier.', flow: 'publication', coversFlows: ['messages', 'team-conversation'],
    source: 'docs/release/evidence/native-admin-close-13a5b1e2-2026-10-24/README.md'},
  {date: '2026-10-24', title: 'Un contrôle de sécurité renforcé',
    text: 'Une alerte de sécurité corrigée et testée en local. D’autres restent à examiner.', flow: 'tracking',
    source: 'docs/release/evidence/bounded-validation-2026-10-24/README.md'},
  {date: '2026-10-24', title: 'L’ouverture du téléphone reste bloquée',
    text: 'Même résultat sur un autre modèle : retour à l’accueil, avant de passer par notre app. Aucun appel effectué.', flow: 'emergency-contact',
    source: 'docs/release/evidence/emergency-dialer-samsung-2026-10-24/README.md'},
  {date: '2026-10-24', title: 'Corriger la fin de l’essai complet',
    text: 'Les parcours de cet essai étaient exécutés, mais il ne se fermait pas. La correction passe en local. L’essai complet reste à relancer.', flow: 'publication', coversFlows: ['messages', 'team-conversation'],
    source: 'docs/release/evidence/admin-client-lifecycle-2026-10-24/README.md'},
];
