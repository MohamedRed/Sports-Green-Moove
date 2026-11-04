const folder = 'docs/release/evidence/ios-authentication-ownership-2026-11-04/';
export const iosAuthentication = {
  source: folder + 'summary.json', checksums: folder + 'source-sha256.json', checkedAt: '2026-11-04',
};
export const iosAuthenticationProgress = {
  date: '2026-11-04', title: 'Une connexion tardive ne rouvre plus le compte',
  text: 'Les essais locaux passent. La déconnexion complète sur iPhone reste à tester.',
  flow: 'signout', coversFlows: ['login', 'session-restoration'], source: folder + 'README.md',
};
