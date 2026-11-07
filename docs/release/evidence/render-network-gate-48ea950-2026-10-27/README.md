# Capture callback failure and mobile-network preparation failure

Reviewed 27 October 2026. Exact head 48ea95027c17d432937c73fb88ebbd5b9204a7c1;
native run 40413819150, main job 121890949452, completed 26 October 23:04:45 UTC
(27 October locally). Original PR metadata has nineteen successful checks, one
failed check and five intentional skips. All ten independent safety cases and
their required aggregator pass. The main native job remains failed.

## Confirmation Capture

The complete ordinary matrix has 231 cases: 176 pass, 54 skip, one fails.
largeTextParentSeesBothVersionsAndAcceptsWithoutApplying reaches the confirmation
review capture at TripChangeFlowTest.kt:97, before the acceptance click. The
original transcript reports "Failed waiting for PixelCopy!". This does not prove
an acceptance, a product decision failure, or a completed large-text journey.

The existing bounded primary observer records exactly one SDK invocation throwing
after 1,084 ms, a maximum sampled main-queue delay of 714 ms, and three sampled
main stacks in HardwareRenderer.nSyncAndDrawFrame. It closes and writes no image.
It explicitly may affect scheduling. These observations narrow the failure to
that capture interval; they do not establish its underlying rendering cause or
justify a timeout increase, retry, different capture primitive or skipped check.

## Network Preconditions

The separate local replay reaches messaging, opens its empty conversation and
types the draft, then times out at LocalChatNetworkFlowTest.kt:82 while waiting
for the prepared dual-network observation. Its result is incomplete, with an
empty network checkpoint array and failedPhase network-preparation. Wi-Fi reaches
the local backend, but there is no cellular callback or valid default data
subscription. Both requested transports are subsequently released. No actual
disconnect, offline send, retry delivery or post-disconnect recovery is accepted.

Before any test app was installed, the carrier observer reported no config-change
notification yet and a bound no-SIM configuration service. Near the later chat
test the notification flag is true and the no-SIM binding false; nevertheless,
the actual data-subscription precondition is still absent. These flags and the
bounded controller history are different observations, not interchangeable
readiness proof. The precise telephony-initialization cause remains unproven.

## Separate Successful Cleanup

All sixteen primary copy receipts and the separate failure-cleanup copy complete
with status zero. This run does not reproduce the earlier primary-copy failure.
Copying artifacts successfully cannot rescue failed screen assertions or the
incomplete network replay. The device restoration receipt independently verifies
local package removal, administrator removal and original policy restoration.

Executed source snapshots are retained by SHA-256. Original reports and transcript
bytes are checksummed; no raw cloud-job log or new gallery media is published.
Earlier phone captures, earlier failures and the earlier green gate remain dated
separately. No product repair, physical tracking, payment or release acceptance
is inferred. The earlier system-image download failure also remains distinct.
