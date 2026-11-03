# Incomplete Callback Readiness

The original production readiness job at `9450ad0b449f081b55591c2833d90709843ac1af`
[fails](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41615866643/job/125849030006)
on the primary return callback's unchanged 15-second health-request deadline.
The provider-secret step passes. Do not replace this failure with the independent
local observations or the historical 22 October configuration pass.

Read-only production logs in the same time window contain a return health request
with HTTP 500 and this platform message: "The request was aborted after waiting
too long for an available instance." A later return health request succeeds with
HTTP 204; the return instance's startup probe succeeds after the CI timeout.
The refresh health request succeeds with HTTP 204. No shared request identifier
was retained by the original CI checker: temporal association is not an exact
end-to-end correlation or proof of an automatic Hosting retry.

The later read-only service configuration has revision maximum instances 1,
request concurrency 1 and startup CPU boost enabled for both services. These
settings do not prove capacity at the incident time. All three incident-time
Monitoring queries return 403, not zero traffic or zero instances. Startup probe
success is not a startup-failure diagnosis. The underlying reason for the unavailable
instance remains unconfirmed; no scaling, billing, secret or deployment change is
justified by these observations alone. Google's
[troubleshooting guide](https://docs.cloud.google.com/run/docs/troubleshooting#cloud-run-couldnt-manage-the-rate-of-traffic)
lists several possible causes, not one established cause for this incident.

At 10:13 UTC, independent credential-free local GETs to the same primary health
URLs return 204 with the correct callback markers. These do not accept driver
onboarding, payments, refunds, the failed CI job, or release readiness. No payment,
customer record, provider configuration, paid resource, timeout or retry policy
was changed. The original diagnostics remain private; only allowlisted fields
are retained here.

The complete head rollup is also retained: 22 success, 6 skipped, 2 failure. Web
and backend pass. The main native job fails with an incomplete ordinary transcript
at case 331/349, SIGTERM and a generic process error. It has no final runner result;
the old receipt does not retain the underlying process error code. Consequently
it is not a completed 349-case pass, confirmed timeout cause, or new network-flow
attempt. The independent replay fails during parent-login preparation and capture
cleanup, before reaching the network case. The earlier Wi-Fi DNS/preparation
failure and source-bound form-view pass remain unchanged. No new media or phone
flow acceptance is added.

The first artifact download stopped at an incomplete transfer. The separately
completed download is checked against the original artifact's full size and SHA256
before selecting its unchanged ordinary transcript/process/status/restoration
members. This is an archive retrieval, not a CI or device rerun.

The website changes only its outdated payment-return blocker and adds one short
progress entry. All 34 flows, media, phone dates, tours, statuses and public access
remain unchanged. Existing web and release commands import the incident checks;
their path triggers include the new test module. No Terraform change is needed.

Local publication checks pass: 4,160 Node tests and the portal browser suite at
1440, 768, 390 and 320 pixels. Desktop overview and the mobile payment blocker
are visually reviewed. All 34 flow fingerprints and all 532 media hashes are
unchanged. The first Node run rejects an old test's assumption that a November 1
update must remain among the six newest visible entries; its original success/
failure history is now tested as an explicit pair, with the entire 396-entry
previous history independently fingerprinted. No partition/UI rule is changed.
The initial browser run stops on ENOSPC. Only ignored, regenerable Android
compilation intermediates/tmp are removed; outputs, reports, original media and
evidence remain. The separate browser run then passes. Neither local validation
repairs or replaces either failed CI job.
