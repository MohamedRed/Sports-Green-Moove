const folder = 'docs/release/evidence/profile-city-2026-10-24/';
const image = (phase, alt, landscape = false) => ({ file: 'profile-city-' + phase, alt: alt + ', essai local du 24 octobre', ...(landscape ? { landscape } : {}) });

export function createProfileCityFlow() {
  return { id: 'profile-city', title: 'Ma ville', status: 'partial', checkedAt: '2026-10-24', latestEvidence: 'local',
    summary: 'La ville reste propre à chaque compte.',
    verified: 'Enregistrement, retour au profil, changement de compte et suppression testés dans l’app, en local. La ville sert seulement au profil.',
    remaining: 'À vérifier sur téléphone et iPhone. Pas encore en ligne.',
    profileCity: { source: folder + 'summary.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-24' },
    images: [image('editor', 'Choix de la ville dans le formulaire'), image('saved', 'Liège enregistrée dans le profil'),
      image('restored', 'Liège retrouvée au retour au profil'), image('other-account', 'L’autre compte n’a pas repris cette ville'),
      image('removed', 'La ville a été supprimée')],
    tour: [
      { image: 'profile-city-editor', title: 'Choisir une ville', text: 'Liège est saisie dans le formulaire.' },
      { image: 'profile-city-saved', title: 'Enregistrer', text: 'La ville apparaît dans le profil.' },
      { image: 'profile-city-restored', title: 'Revenir au profil', text: 'La ville est conservée.' },
      { image: 'profile-city-other-account', title: 'Changer de compte', text: 'L’autre compte garde sa propre ville.' },
      { image: 'profile-city-removed', title: 'Supprimer', text: 'Le profil ne contient plus de ville.' },
    ], source: folder + 'README.md' };
}
