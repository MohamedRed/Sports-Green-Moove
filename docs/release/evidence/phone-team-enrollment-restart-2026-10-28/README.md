# Team enrollment: seven physical-phone process restarts

28 October 2026, run `614b78d6896cf1e31a2323ff23ce1b2f`.

The parent requested, saw a refusal, requested again, saw approval, withdrew,
requested separately for their child and saw the child's approval. The manager's
refusal and both approvals used the management UI and confirmation dialogs.
All seven states were restored after Android App info Force stop and reopening.
Authenticated Home returned each time without entering credentials again.

Each stop has a fresh package-scoped memory query showing the original process,
an absent process after confirmation and a different process after reopening.
The original console text, including two initial unsupported/garbled commands,
is retained unchanged. No application business writes were performed by the
process observer or document reader. Seven original typed document pairs have
identical document names, fields and create/update times. The separate checkpoint
observer replays every event and revision, completes 7/7 and verifies fixture cleanup.

The guardian relation was already verified in the disposable fixture. This run
does not prove the guardian-review UI. It used one physical Android phone with
isolated local services, no real users, maps or payments. The uploaded APK was
selected by its existing label; source APK hash is retained, but installed bytes
were not independently hashed. No production, push-delivery, physical network
loss, GPS, tracking, iOS or whole-release acceptance is claimed.

The user approved session-window captures for the public progress website,
explicitly not native exports. Five restored-state captures are cropped only to
the actual device rectangle. `public-captures.json` binds crops to original context
PNGs and records the crop, source hashes and reviewed synthetic content. There
are no new retained images for the first request and refusal. Older 19 October
evidence and the earlier incomplete connection-recovery trial remain separate.

Both accounts signed out. The first native uninstall click did not remove the
package; that incomplete attempt is recorded. Provider uninstall was then
acknowledged, a fresh package query confirmed absence and the phone session
returned to its idle dashboard. No device administration or store policy changed.
All owned services exited, original runtime and private handoff were absent,
the observed process group no longer existed and all five scoped ports were free.
The admin preview exit 1 after requested stop is not a test pass.

`session-results.json` under `checkpoints/` is the original observer report;
its legacy `teamChatImplemented: false` field is controller metadata, not a
statement about the current whole application's chat implementation.

Validate with `node --test tests/team-process-restart-phone-evidence.test.mjs`.
All artifacts other than this README and the checksum file are bound by
`artifact-sha256.json`. Source archives retain the exact original observer,
backend, management and phone UI files independently of subsequent changes.
