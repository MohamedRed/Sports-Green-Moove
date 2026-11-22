# Real Maps With Isolated Trip Changes

Executed 18 October 2026 at 08:16 UTC. Original generated output: `results.json`,
run `802c47b1718c45f7fa7eebe6f2306636`. The owner explicitly authorized a few
potentially billable map requests using made-up trips and isolated accounts.

The existing Google Places and Google Routes production adapters made exactly
five successful requests: two autocomplete requests, two place-detail requests,
and one Compute Routes request. Public railway stations were used, not customer
addresses. The returned route measured 7,512 metres and 560 seconds.

All accounts, bookings, proposals, quotes and trip writes used the local
`demo-sgm-local-qa` emulators. The existing server map credential was read through
authorized ADC into a temporary owner-readable file, consumed once, deleted and
never printed or included in evidence. No cloud credential was passed into the
isolated runtime. The normal offline functions retain disabled provider secrets
and loopback-only networking. Only the explicitly injected map adapter can reach
the three approved operations; redirects, other destinations and a sixth request
are rejected. Failures are not automatically retried.

Verified through authenticated local callables and persisted-record assertions:

- A free trip had two separately approved parent bookings.
- Each parent received only its own booking reference and confirmed the same
  new route and departure time.
- The route quote was refused before confirmation and after only one agreement,
  without making a billable route request or changing the original trip.
- After both agreements, the production quote service obtained the real route.
  Reusing its request identity reused the same quote without another request.
- Neither parent could apply the change. The driver could apply it once;
  repeating that request returned the same receipt.
- Saved endpoints, departure, distance, duration and polyline matched the quote;
  both bookings acquired the confirmed revision with zero price/balance. Both
  adjustment records were `notRequired`, no payment intent existed, and the
  applied notices and both parent views reflected the applied change.

**Scope:** service/backend integration, not a native-screen or physical-device
replay. The quote service was invoked with the authenticated fixture driver's
UID and the real provider; its callable transport was **not** exercised. Other
mutations and reviews used the actual authenticated local callables. No fake
route, production data write, charge, refund or production deployment occurred.
The in-app address/route/application flow, payments/refunds and physical tracking
remain unverified. Existing screenshots retain their original dates and outcomes;
this run produced no screenshot or video.

Reproduction requires explicit owner approval and an output path that does not
already exist:

```sh
SGM_LOCAL_FLOW_OUTPUT=/absolute/new-result.json node scripts/qa/run-real-maps-local.mjs --approved-isolated-real-maps
```

Do not run this paid integration automatically in routine CI. Web Integration
Smoke runs the credential-free boundary and retained-evidence tests only.
