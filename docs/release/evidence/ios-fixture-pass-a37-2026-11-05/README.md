# A37 iPhone Fixture Gate: Eleven Cases Pass

Checked 5 November 2026. Run 42064566624, source
`a37cdbf263642d2a9a26a0af3cf2b0363886bb97`, completes the SDK-linked build,
all eleven original fixture cases and simulator disposal successfully within the
unchanged 50-minute gate. All eleven cases pass; no case is skipped. Capture
steps are skipped and the artifact inventory is empty. No new image/video is
published or inferred from this result.

The actual screen assertions cover booking/ride conversation opening, persisted
complete text, earlier messages, sending/reopening and an active ride's first
message. The original profile-city save/removal, club request/manager decision,
team text/send, consent, contact/parent selection, ratings and sign-out assertions
also pass. This closes those source-specific synthetic screen regressions, not
their real-service or physical-device equivalents. A visible booking action alone
does not accept a complete real booking/payment flow.

The later owned-search correction is absent from this source. Its SDK build and
screen assertions are still pending, so current release entries are not accepted
from this historical pass. No native/backend/map integration, external-provider
login, real Phone handoff, notifications, physical tracking or release acceptance
is implied. Earlier failures, all old portal records/media/dates/tours/blockers
and public access remain unchanged.

`run.json`, `cases.json`, selected exact test lines and the empty artifact inventory
retain the terminal result. Content-addressed source archives bind the actual
Swift/Xcode/workflow sources to this run; they do not stand in for executed tests.
