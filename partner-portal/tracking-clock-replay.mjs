const base = 'docs/release/evidence/tracking-clock-replay-2026-10-25/';
export const trackingClockReplay = {source: base + 'summary.json', checksums: base + 'artifact-sha256.json', checkedAt: '2026-10-25'};
export const trackingClockCaptures = Object.fromEntries(['foreground-first', 'foreground-returned', 'signed-out-stable']
  .map(phase => ['tracking-clock-' + phase, base + 'photos/' + phase + '.jpg']));
export const trackingClockTour = [
  {image: 'tracking-clock-foreground-first', title: 'Le suivi démarre', text: 'La première position est reçue. Cet essai utilise un trajet et des positions de test, sans carte.'},
  {image: 'tracking-clock-foreground-returned', title: 'Le suivi continue hors de l’app', text: 'Les positions avancent aussi en arrière-plan. Au retour, la même course est toujours active.'},
  {image: 'tracking-clock-signed-out-stable', title: 'La déconnexion arrête les envois', text: 'Après déconnexion, une nouvelle position simulée n’est pas envoyée pendant le contrôle de 50 secondes.'},
];
export const trackingClockImages = trackingClockTour.map(step => ({file: step.image, alt: step.title + ', essai sur téléphone du 25 octobre'}));
export const trackingClockProgress = {date: '2026-10-25', title: 'Les positions avancent sur téléphone',
  text: 'Le suivi continue hors de l’app et les envois s’arrêtent après déconnexion. Trois captures ajoutées. Le trajet réel et le suivi enfant restent à tester.',
  flow: 'tracking', source: base + 'README.md'};
