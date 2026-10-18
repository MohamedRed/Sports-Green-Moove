# Isolated Payment Confirmation, 18 October 2026

`services.json` is a fresh, completed HTTP-callable run against the isolated
`demo-sgm-local-qa` Auth/Functions/Firestore services. Run
`d7dd675fde98227a73c2b4ca2d486617` completed at `2026-10-18T13:56:38.897Z`.
All 11 checks passed. Provider responses were synthetic, with no external
payment requests, real charges, refunds or production writes.

The parent sees pending before reconciliation and recorded only after a matching
immutable receipt and both ledger entries exist. Signed-out, driver-only and
other-parent requests are denied. Extra ownership input is rejected. A paid
flag alone, mismatched ledger, refund-affected record or unrelated intent cannot
produce a confirmed result. Repeated status reads preserve all payment records
and return only booking ID, intent ID and state.

The Android coordinator's eight unit tests additionally cover checkout completion
with delayed status, read failure and explicit retry, refresh failure after a
recorded payment, neutral window closure, account switches during preparation
and status reads, late checkout callbacks, and repeated taps. Two mapping tests
bind checkout/status responses to the original owner, booking and frozen amount.
Swift model checks and the local Swift package build pass; this is not an iOS
device or provider-SDK validation.

Android component layout tests have been added for 320dp/large text, disabled
repeat actions and an inconsistent-record message. Their connected run and
visual review are still pending in this snapshot. No new screenshot is claimed.

## Retained Evidence And Limits

The [16 October supplement report](../local-trip-supplement-2026-10-16/README.md)
remains the evidence for original invoice preservation and two supplements; it
was not rerun or redated here. The existing 11 October empty payment-screen
capture is historical, not proof of checkout.

Not deployed to production. No real checkout, 3-D Secure, refund execution,
supplement checkout UI, payout, physical-device payment, process-death payment
recovery or release-manifest acceptance is established. The remaining payment
work is detailed in `docs/contracts/ride-payment-confirmation.md`.

Reproduce service checks with `node scripts/qa/run-local-payment-status.mjs`.
Set `SGM_LOCAL_FLOW_OUTPUT` to a fresh absolute path to retain the JSON report.
The runtime refuses non-demo projects and non-loopback emulator endpoints,
creates ephemeral credentials privately, blocks external provider egress and
removes its temporary runtime after shutdown.
