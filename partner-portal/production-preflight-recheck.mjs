export const productionPreflightRecheckProgress = {
  date: '2026-11-22',
  flow: 'booking',
  title: 'Le service en ligne doit rejoindre la version à tester',
  text: 'Le contrôle confirme que les réservations, les contacts d’urgence et plusieurs autres parcours attendent encore la mise à jour du service en ligne. La préparation précise les changements et les décisions nécessaires avant les essais de publication sur téléphone.',
  source: 'docs/release/evidence/production-release-preflight-2026-11-22/README.md',
};
import {productionPreflightProgress, releaseGateProgress} from './production-release-preflight.mjs';


export const productionReleaseProgress = [
  productionPreflightRecheckProgress,
  productionPreflightProgress,
  releaseGateProgress,
];
