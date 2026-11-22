const folder = 'docs/release/evidence/ios-fixture-observation-2026-11-04/';
export const iosFixtureObservation = {source: folder + 'summary.json', checkedAt: '2026-11-04'};
export const iosFixtureProgress = {
  date: '2026-11-04', title: 'Le consentement passe en simulation sur iPhone',
  text: 'Changer d’enfant ou de suivi redemande l’accord. Les anciens résultats ne sont plus réservables.',
  flow: 'search', coversFlows: ['booking', 'ratings'], source: folder + 'README.md',
};
export const iosFixtureLaunchProgress = {
  date: '2026-11-04', title: 'L’app iPhone s’ouvre en simulation',
  text: 'Six tests passent. Celui des étoiles d’avis échoue ; la série complète reste à valider.',
  flow: 'navigation', coversFlows: ['ratings'], source: folder + 'README.md',
};
