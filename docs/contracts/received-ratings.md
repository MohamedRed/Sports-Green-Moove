# Received Ratings

The owner chose the average star score and review count on the signed-in user's
profile, without a detailed received-review feed. This is distinct from pending
review requests, submitted-review history and the matching system's driver trust
fields. The implementation does not change `users.driverRating`, trip ranking,
review eligibility or immutable rating submission.

## API And Access

`getReceivedRatingSummary` accepts exactly `{}` from an authenticated account.
The server selects `ratedUserId` from the authenticated UID, never client input.
It returns exactly `{userId, count, average}`. The average is `null` when count is
zero; otherwise it is the unrounded arithmetic mean of received star scores.
Existing and new immutable ratings contribute equally. There is no first-100
query limit and no rating document, author identity or comment in the response.

The server performs a count and average aggregation in one Firestore aggregate
query. The existing submission contract guarantees integer scores from 1 to 5.
Malformed count/average responses fail closed; errors are not treated as zero
reviews or an invented score. Raw rating documents are directly readable only
by their author. Received and unrelated raw reviews cannot be read through
client get/list requests. All direct client writes remain denied.

## Android

The profile row shows one decimal place using French formatting, plus the full
received-review count. No reviews displays `Aucun avis reçu`, not a zero-star or
five-star score. Loading, unavailable and ready are separate states. Refresh is
explicit and also occurs when the profile resumes. A failed refresh removes the
old score rather than presenting it as current.

Gateway checks bind both request and response to the current signed-in account.
The response parser requires the exact fields, correct UID, a safe integral
count and a consistent average. Disposing the profile clears its state and
discards late responses. A new account cannot inherit the preceding score.
The row wraps on narrow screens and with large text.

## Rollout And Verification

The composite `ratings(ratedUserId ASC, score ASC)` index is declared in the
repository's existing `firestore.indexes.json` infrastructure configuration.
Deploy it and wait for readiness before deploying the new callable and narrowed
rules, then release the matching Android client. This work does not deploy any
production resource or change existing Site access. iOS profile support remains
unimplemented; its legacy review-submission flow is unchanged.

The isolated service suite covers zero, 26, 104 and 105 received reviews,
recipient isolation, authentication and forged arguments, duplicate/invalid/
unrelated submissions, raw-document privacy and unchanged original records and
claims. Backend and Android unit tests cover strict aggregate parsing and stale
session disposal. Component tests cover refresh, errors, account switching and
narrow large-text layout. Building them is not evidence they executed.

The separately reproduced 30-ride discovery gap and its later fix are documented
in [pending-review pagination](pending-review-pagination.md). Aggregate-summary
checks themselves do not prove pagination, physical tracking, production
deployment, actual payments or full release readiness.
