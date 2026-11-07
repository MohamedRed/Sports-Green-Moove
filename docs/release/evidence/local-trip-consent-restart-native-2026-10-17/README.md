# Confirmed Consent Survives A New App Process

- Tested source: `4becd4f44d150c76e6fedae1d53acf2dc64e7b2f`.
- Native run: `39074787320`; Android UI job: `117519579503` (success).
- Artifact: `12116509961`; local run: `7c07413926f6fe767cbafb38ee5a9654`.
- Full replay completed: `2026-10-17T22:42:57.471Z`.
- Consent-restart stage completed: `2026-10-17T22:41:31.919Z`.

All 28 local flow groups passed, including the existing booking, ride,
conversation/reply-loss/network, cancellation, two-parent consent, input and
date/arrival groups. The 21 instrumentation transcripts contain 29 native cases;
all nine named evidence copies succeeded. Ordinary instrumentation separately
reported 106 cases: 82 passed, 24 local-only cases conditionally skipped, zero
failures/errors. Those skips do not establish the local replay: its separate
successful transcripts and independent saved-data verification do.

`completed/` retains 71 unchanged original files: all 64 local JSON/text records,
the ordinary XML result, suite exit status, two keyboard-probe logs and three
reviewed native screenshots. `artifact-sha256.json` inventories their original
bytes. The suite status records ordinary tests, component evidence and local
replay all exiting zero. Historical failure records are not overwritten.

## Verified Restart Scope

The driver proposed EUR 2.50 to EUR 4.00 through the app. The parent accepted
through their own account. Before stopping, the host saved hashes of the entire
trip, booking, proposal and its three notices. The prepared native process was
11443. The guarded host helper issued force-stop for the disposable local app
and verified that no app process remained; process 11625 performed the reopening.

The parent session restored without login. The same proposal and saved agreement
were visible, without repeat decision controls, including after two explicit
refreshes. Switching to the driver and using the existing review action showed
the same confirmed/unapplied proposal and amounts. The final host snapshot matched
every checkpoint hash exactly: one decision, three notices, no new quote/balance,
and unchanged original trip/booking. The parent view remained scoped, an outsider
was denied, and the unresolved change still prevented ride start.

The reviewed parent-after image shows the saved agreement and 1/1 confirmation.
The driver image is scrolled to the original/proposed prices and calculation,
withdrawal and refresh controls; it is not presented as a top-of-dialog capture.
The source images are unedited. Only parent-after and driver are added to the
partner gallery; the before image is retained as provenance.

## Still Open

This is confirmed single-parent price consent in an isolated local app run.
It is not pending/partial/refused/withdrawn proposal recovery, unsent-draft
recovery, successful live routes, applying changed terms through the app, real
charges/refunds, push delivery or physical tracking. Search component groups keep
their explicitly simulated matching scope. No release-manifest acceptance,
production deployment or real-device requirement is promoted.

The corrected driver action fixes the test error retained in the
[interruption report](../local-consent-restart-interruption-2026-10-17/README.md).
This successful run does not explain or repair the earlier update, file-sync or
keyboard interruptions. The unsupported reset setup remains removed. No new
updater pause, alternate copy, test retry or provider substitute was used.
