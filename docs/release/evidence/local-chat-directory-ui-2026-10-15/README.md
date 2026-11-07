# Local Conversation Directory App Evidence

Date: 2026-10-15. Source: [Native CI 38814000395](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38814000395),
commit `6bd7c3544b7c6dfed768747ad3ce0001cee81e2f`, artifact
`android-connected-ui-test-results`, run `5aa406e681bb5b00a43fd265a4eeeda6`.
The sanitized `results.json` is copied unchanged. Nine instrumentation cases
passed across five app-process invocations; ten group IDs describe scoped
assertions rather than ten independent test methods. Earlier evidence remains
unchanged. This run predates the session-state and keyboard-resize changes.

## Verified Through The App

The parent loads both conversation pages, finds an older conversation outside
the first page, opens it and reads its seeded message. The reservation picker
then opens the newly published, approved trip with its real title, published
date, driver and child. Opening the empty thread does not create a message or
an inbox entry. The parent sends the first message through the composer.

After actual logout/login, the driver opens that message, acknowledges reading
it, and replies through the app. The parent signs in again, opens the reply and
acknowledges reading it. Independent persisted-state checks require exactly two
new messages, two read recipient notifications and correct private indexes.

The final directory contains 28 conversations: 20 on the first page and eight
on the second. Twenty-five archival sources are seeded fixtures, not newly
performed journeys. One older archival conversation was opened through the UI.
The preceding ride, ledgers, review and conversation cases also pass. The
earlier conversation case includes one explicitly authenticated local SDK peer
send; it is not a second-phone interaction or push-delivery proof.

## Reviewed Captures

Four unchanged app-window PNGs were reviewed with synthetic data only:

- `local-chat-directory-reservation.png`: actual reservation selection.
- `local-chat-directory-empty.png`: titled empty thread before the first send.
- `local-chat-directory-received.png`: first message and driver reply together.
- `local-chat-directory-history.png`: older archived conversation opened.

The two immediate post-send captures have clipped headers and are intentionally
excluded from the portal and this reviewed capture set. The portal retains the
separately reviewed landscape draft from the earlier eight-case run, not the
new run's landscape image. No new video was recorded.

## Remaining Scope

The earlier account-switch crash did not recur in this run; its cause is not
established or claimed fixed. See [earlier attempts](../local-chat-directory-2026-10-15/ui-attempts.md).
The separate [session-state regressions](../local-session-state-2026-10-15/README.md)
prove delayed-response isolation only, not complete account-boundary safety.
Keyboard-visible and restored-layout checks need a fresh run after the resize
configuration change; these screenshots do not prove that correction.

Group-conversation initiation, physical phones, push, network recovery, real
payments and physical tracking remain unproven. Positions are synthetic and
emulator permissions pre-granted. iOS was not migrated or exercised. No live
provider, production data, billing or final release-manifest status changed.
