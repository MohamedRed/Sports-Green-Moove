# Local App Conversation Evidence

Date: 2026-10-15. Source: [Native CI 38797697438](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38797697438),
commit `4d495b2adcf29793c3a4c9538624bcd9bdc18cc9`, artifact
`android-connected-ui-test-results`, run `b365178c9c7c9410681b945a07d985e3`.
The sanitized `results.json` is copied unchanged. Eight local instrumentation
cases passed across four app-process invocations. Nine group IDs describe scoped
assertions, not nine independent test methods. Earlier six/seven-case evidence
directories remain unchanged.

## Verified Through The App

The parent opens an existing received-message preview and types a draft. Leaving
for Home and returning, recreating the activity, and rotating to landscape retain
the same conversation and draft. Back in portrait, the parent sends a message and
the stored server acknowledgement clears the input. The inbox preview updates.

The parent also opens a separately seeded 120-message history. Actual client SDK
queries traverse all three pages without gaps or duplicates and verify descending
document-ID ordering when timestamps tie. The app's older-message action loads
both additional pages and displays the oldest item. These are synthetic historical
fixtures, not 120 messages typed or read by a real user.

Actual app logout/login switches to the driver, who opens the parent's message
and replies through the composer. After another UI account switch, the parent
opens that reply. One additional driver message is sent by a separately
authenticated, demo-only SDK peer while the parent thread remains open; its
arrival appears without refreshing. The parent replies through the app. This
peer send is explicitly not a second-phone UI action or push-delivery proof.

The driver then opens the final response. An unrelated synthetic account sees
an empty inbox; its direct authenticated conversation request is separately
required to fail with permission denied, rather than inferring privacy from an
empty screen alone.

Independent local database checks require five exact messages: the original
fixture, three app-composer sends and the one SDK-peer send. Four new request IDs
are unique, each creates one recipient notification, both participants' read
markers are present, all four notifications have read timestamps, and both inboxes
have zero unread messages for this conversation. The 120 history fixtures remain
intact. The preceding ride/audit/ledger/rating verification also passes.

Separate component cases cover ambiguous-send retries with the same identity,
definite rejection followed by a corrected send, blank/oversized input, draft
retention and inaccessible-thread errors. Those use explicit fake gateways and
are not substituted for the real local conversation case.

## Reviewed Captures

All four synchronized app-window PNGs were visually reviewed unchanged, with
synthetic data only and no credentials. Portrait and landscape controls fit;
there is no keyboard covering the conversation or composer.

- `local-chat-parent-sent.png`: parent's stored message and cleared composer.
- `local-chat-driver-reply.png`: driver's app reply after reading the parent.
- `local-chat-live-reply.png`: incoming peer message and final parent reply.
- `local-chat-landscape-draft.png`: draft retained in the landscape layout.

No new video was recorded. Previous recordings remain separately dated.
The earlier failed run `38795959058` is not accepted evidence; the corrected test
waits for server-loaded composer readiness before entering text.

## Limits

This is an isolated, loopback-only demo run on a disposable emulator, not physical
phone or live-provider evidence. It does not prove push, offline/network recovery,
payment settlement or real tracking. No final release-manifest requirement is
accepted by these results.

The app still cannot initiate a first message directly from a reservation. Inbox
discovery is bounded to the latest 50 messages, even though an opened thread has
older-history pagination. Legacy keyless sends lack retry deduplication; random
legacy notification IDs are not guessed or blanket-cleared. iOS thread UI is not
included. Deploy the checked-in callables and message index before releasing the
new Android client; this run does not deploy them.
