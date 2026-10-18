# Explicit Real-Map Native Integration

The owner approved real maps with isolated accounts and bookings. The prior
[backend replay](../release/evidence/real-maps-local-2026-10-18/README.md) passed,
but did not exercise app screens or the quote callable. The new native replay
is not accepted until its actual output, provider evidence join, device cleanup
and screenshots have been inspected.

`Native CI` has a default-false `real_maps_ui` dispatch input. Only an explicit
dispatch with that input invokes the separate reusable workflow. It does not
replace, skip or inject real routes into the routine offline PR matrix. The
native case assumes out when its run-bound approval argument is absent.

The approved replay compiles the local-only app before device mutation, uses the
existing guarded disposable Google Play test image, temporarily restricts only
store background work, and verifies/restores its original policy. It does not
disable Maps, location or security settings. Android Maps rendering uses its
existing restricted Android credential as in ordinary CI. Rendering requests are
separate from the hard five-request Places/Routes server allowance below.

Accounts, bookings and mutations use `demo-sgm-local-qa` on loopback. The actual
server Maps key remains only in the parent broker; local Functions receive an
ephemeral broker token as their test provider credential and no cloud ADC.
Their ordinary network guard stays active. An explicit fetch bridge forwards
only known Places/Routes operations to an authenticated loopback broker, which
makes the original Google request with redirects refused and one shared cap of
five attempts across all Functions workers. Other outbound transports and
production Firebase remain blocked. Failure produces no replacement route or
automatic retry. Nothing changes in deployed application/provider code.

The native test uses MainActivity and real local Firebase gateways to select two
public station suggestions, resolve their coordinates, submit the route change,
switch between two parent accounts to confirm, and switch back to the driver to
calculate and apply the real route. The original route must remain stored until
application, parents must not have application controls, and a quote must precede
driver application. Both bookings are free; no payment intent, charge or refund
is created. Separate persisted checks validate consent, quote, endpoints, route
metrics/polyline, booking revision, zero balances and scoped parent views.

`results.json` is the native/persisted stage, **not** the whole-run acceptance.
`real-maps-provider.json` records actual status/operation observations and bounded
response facts, never the key or account credentials. `verified.json` is written
only after joining the native-selected IDs, actual provider coordinates/route,
and stored trip hash under the same run, followed by runtime credential cleanup.
The outer device restoration receipt and job outcome must also pass. Failed
evidence copies stay failed, without retry or alternate transfer.

Two actual screenshots are requested: selected places and applied change. Review
them before adding them to the private portal. This still is not physical-device,
tracking, payment/refund or production-release evidence. No infrastructure is
created or changed; Terraform changes are not required.
