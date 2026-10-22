const proof = 'docs/release/evidence/browserstack-parent-search-2026-10-18/';
const shot = (file, alt) => ({ file, alt });
const phone = { source: proof + 'results.json' };

export function createNavigationFlow() {
  return { id: 'navigation', title: 'Accueil et navigation parent', status: 'partial', checkedAt: '2026-10-18',
    summary: 'Le parent reste connecté après fermeture complète sur téléphone.',
    verified: 'L’accueil revient sans nouvelle connexion. Le calendrier et le changement de mois ont été vérifiés en local le 15 octobre.',
    remaining: 'Rejouer entre téléphones et améliorer l’affichage pendant le chargement.',
    phone,
    ui: { source: 'docs/release/evidence/local-ui-2026-10-15/results.json', groups: ['parent-app-ui'], checkedAt: '2026-10-15' },
    images: [shot('phone-session-restored', 'Accueil retrouvé après fermeture complète, sur téléphone le 18 octobre'),
      shot('local-home', 'Accueil avec le trajet de test en local, le 15 octobre'),
      shot('local-calendar', 'Calendrier vérifié en local, le 15 octobre')],
    clips: ['home-to-trips'], recording: 'navigation', source: proof + 'README.md' };
}

export function createSearchFlow() {
  return { id: 'search', title: 'Recherche de trajets', status: 'partial', checkedAt: '2026-10-20',
    summary: 'Les adresses choisies mènent à une demande de deux places pour l’enfant, en local.',
    verified: 'Wavre et Bruxelles-Central sont retrouvés. Le parent choisit Lina, deux places et son consentement ; un trajet est trouvé et une seule demande est enregistrée.',
    remaining: 'Terminer la recherche complète et une réservation de deux places pour un enfant sur téléphone. Vérifier le classement, une vraie déconnexion et la reprise après coupure. Simplifier le choix de date.',
    phone: { ...phone, checkedAt: '2026-10-18' },
    searchBookingUi: { source: 'docs/release/evidence/parent-search-booking-native-2026-10-20/search-booking-results.json', checkedAt: '2026-10-20' },
    ui: { source: 'docs/release/evidence/local-search-options-ui-2026-10-16/results.json',
      groups: ['search-input-ui', 'search-session-ui', 'search-criteria-ui', 'search-retention-ui'], checkedAt: '2026-10-16' },
    images: [shot('search-booking-choices', 'Adresses choisies, Lina, deux places et consentement, essai local du 20 octobre'),
      shot('search-booking-requested', 'Un trajet trouvé et une seule demande envoyée, essai local du 20 octobre'),
      shot('phone-child-two-seats-consent', 'Enfant et deux places sélectionnés, sur téléphone le 18 octobre'),
      shot('phone-child-consent-reset', 'Consentement remis à zéro au changement de choix, sur téléphone le 18 octobre'),
      shot('phone-child-incomplete-search', 'Adresses manquantes : aucune réservation créée, sur téléphone le 18 octobre'),
      shot('search-options-retained', 'Choix conservés dans l’essai local simulé du 16 octobre'),
      shot('search-options-invalidated', 'Anciens résultats retirés en local le 16 octobre'),
      shot('search-account-cleared', 'Compte simulé : recherche vidée le 15 octobre'),
      shot('local-search-empty', 'Recherche sans résultat le 15 octobre'), shot('places', 'Suggestion de lieu vérifiée le 11 octobre')],
    source: 'docs/release/evidence/parent-search-booking-native-2026-10-20/README.md' };
}
