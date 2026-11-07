# Android Subscription Diagnosis And Complete Local Replay

Executed source: `146730fba6e39a517922d91ac670627e50a23b8f`.
[Native CI 39010701751](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39010701751)
passed all enabled jobs. Backend, Web Integration Smoke and Release Readiness
also passed on that source; the PR verifier reported no missing, incomplete or
failed checks. The two iOS jobs remain intentionally skipped for cost control.

## Observed Run

Run `f6abebee31f9938c2dbae2cb916bd826` finished at
`2026-10-17T06:54:54.029Z`, with 23 executed cases and 23 verified groups.
The 15 original instrumentation transcripts, complete result, network receipt,
booking SDK receipt, modem states and sanitized subscription summaries are
retained without rewriting earlier runs. `artifact-sha256.json` records their
original byte hashes. Its transcripts are raw test output, not edited recordings.

The actual network replay observed Wi-Fi and cellular readiness, cellular-only
handover, both radios disabled with no network and an unreachable isolated
backend, then restored connectivity. The app retained the unconfirmed message
and draft, the explicit retry succeeded, the other account replied, and the
original account received that reply without inheriting the other account's
draft. The independently checked result reports two messages, two notices and
no duplicate messages.

Before and after that case, Android's subscription service reported one active
modem, one mapped slot, `LOADED`, all subscriptions loaded and valid default/active
data subscriptions. App observations also reported a valid default subscription.
The retained service event sequence contains `NOT_READY`, `READY`, then `LOADED`;
no raw service dump, subscription identifier, ICCID or phone number is retained.
This establishes a working comparison run, **not** the cause of the previous
intermittent missing-subscription failure. No radio configuration, route,
deadline, assertion, test count, retry or skip was changed to obtain this result.

Booking SDK recovery independently discarded a verified successful reply,
reopened the disposable app in a different process (5942 to 6038), and recovered
the same request and original booking. Two requests produced one booking and one
receipt; the pending identity cleared only after acknowledgement. This source
includes the cached-write durability correction, unlike the earlier complete
`4c0b263` replay. This is an SDK process-restart test, not an interactive booking
screen or an actual power-loss/storage-full phone test.

## Still Open

The preceding failed run on `cb6a89c` is not reclassified by this success. Its
network case stopped before disconnecting, with Wi-Fi only and no default data
subscription in the app observation. Its original app/modem receipts and failed
instrumentation transcript are retained separately with `failed-` names. It has
no service dump, so comparing these
two runs does not locate a service, cache or initialization defect. The new
read-only collector remains enabled for the next failure; a blind successful
rerun is not treated as the reliability fix.

All fixtures and services here are isolated and synthetic. Search input cases
explicitly use fake gateways; ride locations are synthetic. No physical-device
GPS/background/network/battery qualification, iOS SDK execution, real payment,
refund, provider push or production deployment occurred. The editing and parent
confirmation screens, other documented flow gaps and final release evidence
remain incomplete. Existing portal captures keep their original dates; this run
does not create a new user-facing video or retimestamp an older recording.
