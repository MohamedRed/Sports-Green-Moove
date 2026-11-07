# Native Date And Desired-Arrival Consent

Source: [Native CI 39051222354](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39051222354),
head `d7aa0c75fb6724372839fac4d82cb52a0fae14bd`, Android job
`117450037788`, artifact `12108566372`. The Android app job succeeded.

The isolated app/backend replay completed all 27 required groups at
`2026-10-17T17:13:25.685Z`, run `76cf616fa629db00119e6d9c89052cf4`.
The ordinary XML declares 104 cases: 82 passed, 22 conditional local/live skips,
zero failures and zero errors. These skips do not replace the separate app
replay. Both keyboard probes executed successfully in the ordinary suite.

## New Executed Flow

The driver used the actual native calendar and time picker. Cancelling a new
date retained the original draft. A past departure and an arrival before
departure both blocked proposal submission. After correcting the date/time,
the driver proposed departure on 19 October rather than 18 October and added
desired arrival at 12:00 Brussels time on 19 October.

The parent signed into their own account, opened their affected reservation,
saw both dated departures and the new arrival, and accepted. The price remained
EUR 2.50. The review showed one agreement out of one and a recorded decision;
there was no parent apply action and the proposed details were not yet applied.

The named schedule copy succeeded before independent host verification. Host
checks required one proposal only, exact actor/booking/terms, unchanged original
trip and booking, scoped parent review, outsider denial, zero route quotes and
exactly three unique notices. The run-bound schedule stage completed at
`2026-10-17T17:10:49.002Z` and is embedded verbatim in the full result.

## Retained Evidence

`completed/artifact-sha256.json` identifies 61 original files: all 56 JSON/text
records from the full replay, the ordinary XML, suite exit-status record, two
ordinary keyboard-probe logs and one reviewed native screenshot. This includes
19 successful instrumentation transcripts and eight successful named copy
receipts. Other original images remain in the linked complete CI artifact;
the portal keeps previously reviewed images at their earlier source paths.

`local-trip-change-date-arrival-confirmed.png` was visually reviewed at its
original 1080x2140 size. Both dates, desired arrival, unchanged price, one-parent
agreement and not-yet-applied message are readable. It contains only disposable
QA fixture details. It is published without editing its app contents. The map's
unavailable state is preserved, not concealed or presented as route proof.

## Remaining Scope

This proves local date/desired-arrival consent and the invalid/cancelled draft
guards, not successful place lookup, a changed route, application after consent,
real payment/refund, physical tracking or consent recovery after process death.
The same run also replayed the earlier price/time consent, refusal/withdrawal,
booking, membership and strict message network/restart groups.

The [preceding focus/copy failures](../local-schedule-preparation-2026-10-17/README.md)
remain retained. Passing this run does not explain either intermittent failure
or establish that the window-focus wait fixed the cause. The two passing probe
logs were already focused before touching the field. No retry, forced focus,
different copy path, provider substitute or production mutation was added.

Team chat, account settings, the emergency-contact action, real payments and
the required physical-device/safety-audit evidence remain incomplete. No final
release-manifest requirement is accepted merely because this app replay passed.
