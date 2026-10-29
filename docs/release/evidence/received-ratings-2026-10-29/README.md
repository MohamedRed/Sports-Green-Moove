# Received Rating Mean And Count

The owner selected the average star score and review count, without detailed
received reviews. The implementation reads all ratings for the authenticated
recipient through an aggregate query; it does not scan the first 100 records.
It returns only UID, count and average. Direct raw review reads are restricted
to their author. No driver trust field, matching score or submission policy changes.

## Isolated Service Verification

Eight authenticated groups pass: zero reviews, forged account/limit arguments,
104 received reviews with 358 total stars, separate recipients, an additional
review giving 105 and 363 total stars, duplicate/invalid/unrelated submissions,
raw get/list/update/delete access, and repeated read-only refreshes. All 158
original records and original actor claims remain unchanged. The first attempt
stopped during preparation before any check because its runner omitted the
private session path. Its receipt and original controller/runner are preserved.
The corrected run uses a fresh disposable runtime, not replacement evidence.

All 517 backend units and 622 Android units pass. The three new native component
cases build but were not executed locally. Their future CI execution must be
verified separately. The first Android preflight failed on an invalid typography
token; the corrected build uses the existing `BodyBase` token. Both original
failure and successful build logs are retained.

## One Physical Phone

One Pixel 9 Pro / Android 15, three sequential isolated accounts. Six independent
record checkpoints accompany a separate manual UI review:

1. Driver profile displays `Aucun avis reçu`, not an invented score.
2. After fixture preparation, explicit refresh displays `3,4 / 5`, `104 avis reçus`.
3. After one further fixture-submitted review, refresh displays `3,5 / 5`, `105 avis reçus`.
4. Parent profile displays `4,0 / 5`, `26 avis reçus`, not the driver's summary.
5. The third account has no received reviews and inherits neither earlier score.
6. Final sign-out returns to an empty login form.

The summary was also visible and scroll-accessible in landscape, without overlap;
portrait was restored before subsequent sign-ins. Orientation is not process
restart proof. All 209 rating documents were fixture-submitted through authenticated
local service calls. This run proves summary reading/refresh, not phone rating
submission or completing rides. Original rating/ride records and claims remain
unchanged at every checkpoint; only actor initialization timestamps may advance.

Seven original JPEG session-window crops are retained. Five reviewed crops are
selected for the public Site. These are not native screenshot exports or video.
The selected APK is `sgm-received-ratings-isolated-wip-20261029.apk`, local package
`be.sportgreenmoove.app.local`, built with isolated services at `localhost`.
Its exact source APK hash and native source hashes are retained. The implementation
was uncommitted on baseline `5246a07` when built; installed bytes were not independently
hashed. No production configuration or customer data was used.

## Open Findings

The separate 31-ride probe reproduces a pending-review discovery defect: one
expected driver prompt is absent and only 30 of 31 parent prompts are returned.
The completed omitted ride has no submitted driver rating. Original records,
claims and ratings remain unchanged. This is retained as an open defect, not a
passing flow. The new summary does not repair that unrelated inbox pagination.

The prior `5246a07` native run is terminal and failed: ordinary cases report
186 passed, 54 skipped and one failure while waiting for PixelCopy in
`TripChangeFlowTest.agreementStillRequiresRouteAndApplicationAndDoesNotClaimSettlement`.
The separate team-conversation job failed downloading the emulator archive before
starting its test script. Original terminal metadata and exact failure excerpts
are retained. No capture fallback, suppressed failure or renderer repair is claimed.

The matching backend, rules and index are not deployed to production. iOS profile
display, the long-history defect, a passing complete native gate, physical tracking,
safety audit receipts, support delivery and other release requirements remain open.

## Disposal

All three accounts signed out. The remote clipboard was replaced with non-sensitive
text and the original local clipboard restored. The provider returned to its idle
dashboard. The observer exited 0, runtime and helper 130 after requested SIGINT;
their supervised groups stopped. Independent PID, path, runtime-directory and
six-port checks confirm disposal. No browser restart, real map request or payment
occurred. Public access is unchanged. Every artifact except this README is hashed.
