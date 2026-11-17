export const supportSubmissionCaptures = {
  'support-recheck-history': 'docs/release/evidence/support-recovery-recheck-2026-10-30/captures/10-parent-history-session.png',
  ...Object.fromEntries(['prepared', 'pending', 'confirmed', 'reopened'].map(id => ['support-confirmed-phone-' + id,
    'docs/release/evidence/support-confirmed-restart-phone-2026-10-23/captures/' + id + '.png'])),
  ...Object.fromEntries([['prepared', '01-prepared'], ['uncertain', '02-unconfirmed-before-stop'],
    ['restored', '04-draft-restored-new-process'], ['confirmed', '05-confirmed-after-explicit-retry'],
    ['history', '06-single-matching-history-item'], ['details', '07-original-urgent-request-details']]
    .map(([id, file]) => ['support-restart-phone-' + id,
      'docs/release/evidence/support-process-restart-phone-2026-10-22/captures/' + file + '.png'])),
  ...Object.fromEntries([['prepared', '01-prepared'], ['unconfirmed', '05-unconfirmed-offline'],
    ['history', '07-requester-history'], ['details', '08-saved-details']].map(([id, file]) => ['support-recovery-phone-' + id,
    'docs/release/evidence/support-recovery-phone-attempt-2026-10-22/captures/' + file + '.png'])),
  ...Object.fromEntries(['unconfirmed', 'restored', 'confirmed', 'storage-error'].map(name => ['support-submission-' + name,
    'docs/release/evidence/support-submission-recovery-2026-10-22/images/support-submission-' + name + '.png'])),
};
