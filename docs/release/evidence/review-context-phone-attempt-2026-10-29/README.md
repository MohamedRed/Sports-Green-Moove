# Contextual Review Phone Attempt, 29 October 2026

This is a partial physical Android trial of the contextual review implementation
at `74e8bd8c01b18c6e47c58b6e5c4afc2d4238e302`, not a completed two-account replay.
The source APK SHA-256 is retained; remote installed bytes were not independently
read back. The isolated APK used the disposable demo backend through the signed,
four-service allowlisted connection. No maps, real payments or production writes.

## Observed

The driver signed in, opened Messages / Avis and saw `Entraînement U12`,
`29 octobre 2026 à 18:45`. Tapping five stars displayed `Avis envoyé` and
`Aucun avis en attente`. The two original session-window JPEGs are unedited
window captures, not native exports or a video.

Two independent read-only checkpoints verify the exact last ride/target and
five-star stored rating. The driver's remaining request count changes from one
to zero; the parent's 32 requests, including one explicit unavailable context,
remain unchanged. All 158 original records and account claims are preserved.
The observer fixture submitted 31 initial ratings, but not the phone's new rating.

After sign-out, repeated remote keyboard/clipboard entries failed authentication.
An independent isolated authentication request accepted the session credential.
That does not establish which bytes reached the phone, or prove an application
authentication defect or a repaired input mechanism. Some attempts also used
coordinates across a changed viewport. No credential-entry image is retained.
The ordered observer stopped after two of eight checkpoints; `completed` remains
false. Parent pagination, same-named selection, legacy UI, reconnection and
interruption recovery are not proved by this trial.

## Cleanup

The driver signed out before the failed reconnection attempts. The provider
confirmed uninstalling the disposable app and returned to its idle dashboard
after Stop Session. This is provider UI observation, not an independent package
inventory. The observer closes both clients. The owned backend/helper stop;
their runtime and private handoff directories and session file are absent, and
all six checked local endpoints are closed. The host clipboard was restored.
No device-policy or personal-device settings were changed in this attempt.

## Separate Automatic Checks

The current web job failed with `spawnSync git ENOBUFS` while inventorying all
tracked files for a small credential-evidence folder. The unchanged failure is
reproduced locally. Scoping `git ls-files -z -- <evidence-folder>` retains all
membership, checksum and revocation assertions. A real temporary index containing
9,000 unrelated long paths reproduces the broad buffer failure and verifies the
scoped result. Eight rotation tests pass without provider calls or rotation.

All 27 targeted contracts pass. A first broad run, mistakenly started while the
phone backend held port 5001, has five `EADDRINUSE` failures. All 2,721 cases pass
unchanged after owned environment disposal; both transcripts are retained.
The expanded evidence suite then finds three stale gallery/status expectations.
The new phone media uses the trip-context namespace; the status expectation now
points to this later partial phone attempt. All 2,737 final cases pass, with the
three-failure and final passing transcripts retained separately.

The separate current-head team-conversation CI lane fails connecting to its
authentication emulator after device-offline observations. Its original log is
retained, not attributed to or repaired by the Git inventory change. The earlier
complete gate pass remains a different source baseline. Full current-head CI and
the broader physical tracking, safety, operational and store requirements remain
open. No release-manifest acceptance is changed.
