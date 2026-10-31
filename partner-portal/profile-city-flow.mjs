const folder = 'docs/release/evidence/profile-city-2026-10-24/';
const image = (phase, alt, landscape = false) => ({ file: 'profile-city-' + phase, alt: alt + ', essai local du 24 octobre', ...(landscape ? { landscape } : {}) });

export function createProfileCityFlow() {
  return { id: 'profile-city', title: 'Ma ville', status: 'partial', checkedAt: '2026-10-24', latestEvidence: 'phone',
    summary: 'La ville reste propre à chaque compte.',
    verified: 'Enregistrement, changement de compte, retour et suppression testés sur téléphone avec des données de test. La ville sert seulement au profil.',
    remaining: 'À vérifier sur iPhone. Pas encore en ligne dans l’app.',
    profileLedgerPhone,
    profileCity: { source: folder + 'summary.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-24' },
    images: [...phoneCityImages, image('editor', 'Choix de la ville dans le formulaire'), image('saved', 'Liège enregistrée dans le profil'),
      image('restored', 'Liège retrouvée au retour au profil'), image('other-account', 'L’autre compte n’a pas repris cette ville'),
      image('removed', 'La ville a été supprimée')],
    tour: phoneCityTour, source: profileLedgerPhone.source.replace('summary.json', 'README.md') };
}
import {profileLedgerPhone, phoneCityImages, phoneCityTour} from './profile-ledger-phone.mjs';
