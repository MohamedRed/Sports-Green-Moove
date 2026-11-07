const folder = 'docs/release/evidence/profile-ledger-phone-2026-10-24/';
export const profileLedgerPhone = {source: folder + 'summary.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-24'};
const image = (phase, alt) => ({file: 'profile-ledger-phone-' + phase, alt: alt + ', essai sur téléphone du 24 octobre'});
export const phoneCityImages = [image('parent-ready', 'Profil sans ville'), image('parent-city-saved', 'Liège enregistrée'),
  image('driver-ready', 'Namur dans le compte conducteur'), image('parent-returned', 'Liège retrouvée dans le compte parent'),
  image('parent-city-cleared', 'Ville supprimée du profil')];
export const phoneLedgerImages = [image('parent-ready', 'Impact complet du compte parent'), image('parent-rewards', 'Solde complet du parent'),
  image('driver-rewards', 'Solde distinct du conducteur'), image('parent-returned', 'Solde du parent retrouvé au retour')];
const step = (phase, title, text) => ({image: 'profile-ledger-phone-' + phase, title, text});
export const phoneCityTour = [step('parent-city-saved', 'Enregistrer sa ville', 'Liège apparaît dans le profil.'),
  step('driver-ready', 'Changer de compte', 'Le conducteur retrouve Namur, sa propre ville.'),
  step('parent-returned', 'Revenir à son compte', 'Le parent retrouve Liège.'),
  step('parent-city-cleared', 'Supprimer sa ville', 'Le profil revient à « Non renseignée ».')];
export const phoneLedgerTour = [step('parent-ready', 'Compter tout l’historique', 'Les 257 écritures ajoutées et le trajet initial sont comptés.'),
  step('parent-rewards', 'Retrouver le solde complet', 'Le solde de test est de −220 €.'),
  step('driver-rewards', 'Garder des comptes séparés', 'Le conducteur a son propre solde de test : 10 002,49 €.'),
  step('parent-returned', 'Revenir sans changement', 'Le parent retrouve son solde de −220 €. Aucun argent réel utilisé.')];
export const profileLedgerProgress = [{date: '2026-10-24', title: 'La ville et les gains passent sur téléphone',
  text: 'Enregistrement, suppression et changement de compte réussis. Les longs historiques gardent leurs totaux. Sept captures ajoutées, avec des données de test.',
  flow: 'profile-city', coversFlows: ['impact'], source: folder + 'README.md'}];
