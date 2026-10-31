export const assets = {
  places: { source: '08-search-origin-resolved.jpg', crop: [286, 604, 342, 134] },
  guard: { source: '11-parent-publish-restriction.jpg', crop: [286, 604, 342, 134] },
  notifications: { source: '13-notifications-empty.jpg', crop: [286, 604, 342, 134] },
  payments: { source: '15-payments-empty.jpg', crop: [286, 604, 342, 134] },
  support: { source: '21-support-required-description.jpg', crop: [286, 604, 342, 134] },
};

export const videos = {
  'support-submission': 'docs/release/evidence/support-submission-recovery-2026-10-22/recording-original.mp4',
  navigation: 'docs/release/evidence/browserstack-2026-10-13/parent-navigation.mp4',
  signout: 'docs/release/evidence/browserstack-2026-10-13/signout-relaunch.mp4',
};

export const excerpts = {
  'support-submission-retry': { video: 'support-submission', start: 10, end: 20, poster: 14 },
  'home-to-trips': { video: 'navigation', start: 54, end: 70, poster: 64 },
  'parent-guard': { video: 'navigation', start: 125, end: 140, poster: 135 },
  'signout-action': { video: 'signout', start: 27, end: 40, poster: 38 },
  'signed-out-relaunch': { video: 'signout', start: 86, end: 101, poster: 99 },
};
