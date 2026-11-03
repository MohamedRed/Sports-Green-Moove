const folder = 'docs/release/evidence/compatible-security-patches-2026-11-03/';

export const compatibleSecurityPatch = {
  source: folder + 'summary.json', checkedAt: '2026-11-03', checksums: folder + 'artifact-sha256.json',
};

export const compatibleSecurityProgress = {
  date: '2026-11-03', title: 'Moins d’alertes de sécurité',
  text: 'Les correctifs passent les essais locaux. Il reste cinq alertes élevées à traiter.',
  flow: 'publication', source: folder + 'README.md',
};
