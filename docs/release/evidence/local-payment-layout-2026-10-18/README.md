# Scoped Payment Layout Evidence From A Failed Native Suite

Run `39137615346`, source `2ab678688d8362d1653a2457e49d8d924c7cdc5b`,
retains 124 ordinary cases: 92 passed, one failed, 31 skipped, zero errors.
`general-ui.xml` is the original artifact, SHA-256
`8c8430926d7886c6ba01a06e55088799b1f166a96e7e3b6437bfddd330887172`.
The full Native CI run failed. It must not be relabeled as successful.

All three `PaymentConfirmationLayoutTest` cases completed successfully. The
derived `results.json` selects only those three cases, and separately retains
the failed enclosing suite. These use callback fixtures, not a payment gateway
or application backend. Narrow pending confirmation uses a 320 dp host and
1.3 font scale; the two controls fit horizontally, the read-only check receives
one callback, and checkout stays disabled. The review state remains explicitly
unconfirmed; checking disables repeated taps. These are component assertions,
not checkout, authentication, process-death or provider outcomes.

The four original PNGs are retained unchanged and were visually reviewed.
The narrow component capture is 840x2400; the normal component and two full
display captures are 1080x2400. The narrow full display intentionally includes
space outside its constrained test host. Only the two component images are
allowlisted for the portal. The booking name/date/amount are static fictitious
fixtures, not a live booking. Secondary/disabled text contrast remains a known
separate design issue; these captures do not certify overall accessibility.

## Outstanding Failure

`agreementStillRequiresRouteAndApplicationAndDoesNotClaimSettlement` failed in
`captureLocalUi` with `Failed waiting for PixelCopy!`. Its assertions after
that capture were not reached. No capture fallback, retry, timeout extension or
test suppression has been added. This run reports no input-focus failure;
that does not explain or repair prior intermittent focus loss or process stops.
`ordinary-failure/` retains the new read-only diagnostics. The crash buffer is
empty and exit-info has no application exit entries; that absence is not proof
that every earlier failure had the same cause. The screenshot subsystem's root
cause is still unresolved.

The separately retained `isolated-replay.json` reports 33 completed groups and
35 native cases with matching run `61e59f51bf20e416eb5df4e8c63c8bdb`.
`native-suite-status.json` records ordinary=1, collection=0, replay=0. The
disposable store restore also verified successfully. These facts do not turn
the failed ordinary suite green or replace the original dated evidence for
other flows. `artifact-sha256.json` preserves original artifact file bytes.

No money moved, production was not deployed, and no physical-device tracking,
real checkout/refund, safety event or release-manifest requirement is accepted.
The older service and empty-screen evidence stays at
`../local-payment-confirmation-2026-10-18/` with its original scope and dates.
