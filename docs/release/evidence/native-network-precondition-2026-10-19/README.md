# Native Matrix: Network Preparation Failure

Run [39239354873](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39239354873)
finished with failure on 19 October 2026 at source
`a6c37d6b9b3b1b8a65cbfd612b592a29870c5df6`.
Isolated replay ID: `201438ab42cb5ccd80e0269f1964ae42`.

## What Passed

The original `ordinary-suite.xml` records 144 cases: 110 executed passes,
34 explicit skips, zero failures or errors. `native-suite-status.json` records
ordinary tests 0, component evidence 0, local replay 1. These scoped passes do not
make the complete matrix successful.

The installation restriction was verified during instrumentation. Final cleanup
has `restored: true` and `verified: true`: temporary administration and helper
were removed, the original installation policy was restored, maps runtime stayed
unchanged and location remained enabled. The store's background modes and
original stopped state were restored. This is an emulator result, not evidence
that an administrator was installed on a personal or remote physical phone.

## What Failed

`LocalChatNetworkFlowTest-instrumentation.txt` retains the actual failed test:
`LocalEmulatorNetwork` rejects its initial state because both required radios are
not enabled. The assertion is unchanged. This occurs before registering transport
requests, disconnecting the network, sending offline or retrying a message.

`local-chat-network-ui.json` therefore remains `completed: false`, with an empty
network sequence and null request-release fields. Its historical phase label is
`booking-picker`: construction fails before the code advances to
`network-preparation`. It does not identify a booking-selection failure.

The read-only before/after subscription summaries show no loaded subscriptions,
no mapped SIM slot, an unknown SIM state and no valid default or active data
subscription. The modem console independently reports voice/data registration
`home`. Modem registration alone is not usable application cellular connectivity.
The default-selection diagnostic has no recognized readiness event and the
carrier-loader summary does not establish completed SIM setup.

The retained receipt does not say which individual enabled-radio Boolean failed.
These observations do not establish why the subscription is unavailable. No
subscription, route or radio state was fabricated or automatically repaired.
The next investigation must establish the disposable image's SIM/data readiness
and capture the initial radio states before replaying the same strict scenario.
No scenario is skipped, retried or weakened to turn this run green.

`adb-pull-failure-cleanup.json` records a successful **cleanup-time** transfer of
117 files. It is not a completed network scenario or an alternate passing export.
No capture from this failed network attempt is published as successful evidence.
The separately verified phone/manager enrollment journey remains separate.

## Retained Artifacts

`artifact-sha256.json` binds 17 byte-for-byte original artifacts copied from
`android-connected-ui-test-results`: five suite/policy receipts, the JUnit XML,
the failed instrumentation transcript, incomplete network receipt, eight bounded
read-only network summaries and the cleanup-time transfer receipt.
`source-sha256.json` records seven unchanged source files, compared with the run's
Git objects when retaining this report. It is a dated source binding, not a claim
that later source must never change.

No release-manifest item is accepted. The full native matrix, physical tracking,
payments, safety-audit exports and remaining user flows stay open.
