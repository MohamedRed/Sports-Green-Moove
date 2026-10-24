# Commission Presentation, 24 October 2026

The owner confirmed that the launch commission is still undecided. Removed only
the fixed `Frais plateforme / 0 EUR` row and its internal business placeholder
from Android and iOS Options. No fee configuration, invoice, ledger, provider
request or production resource is changed. The documented absent-rate default
is not a confirmed commercial offer.

Local verification:
- The initial Android placeholder regression failed against unchanged source.
- Three source-contract checks now cover both platforms and preserve working
  notification, emergency and support controls.
- Forty existing payment-fee unit cases pass, including the absent-rate default,
  invalid configuration, exact rounding and frozen invoice reconciliation.
- The related session/proxy/evidence/notification selection passes 81 checks.
- The complete root suite passes 2,033 checks after updating two stale portal
  expectations (the old settings blocker and the six-item news window).
- Android app and instrumentation APK compilation passes. An invalid assertion
  import in the first build was removed; no assertion was removed.
- Android's existing Options flow now asserts the fee label and value are absent.
  Its connected execution is still pending; compilation alone is not an app test.
- iOS source is checked, not built or exercised on a device.

No new screenshots, phone result, payment transaction, production deployment or
release acceptance is claimed. Existing captures keep their original dates.

## Reconnection Test Investigation

Native CI run 40095906753 at e42ee17c completes its main job and nine focused
lanes successfully. The session-restoration lane's Android case reports `OK
(1 test)`, then the independent observer rejects `proxy.receipt.failed === true`
at local-session-restoration-ui.mjs:62. The aggregate correctly fails too.

The new profile screen reads getProfileCity; the controlled proxy previously
allowed only initializeUserProfile and getActiveRide. A new regression reproduces
the rejected city read (502 instead of 200). Only the empty, same-parent city read
is added after recovery, with an upstream owner check. City writes, foreign
identities, non-empty requests and reads before recovery remain rejected. Ten
proxy tests pass. A new complete CI replay is still required; earlier logs do not
record the rejected URL, so the failing boolean alone is not endpoint evidence.
