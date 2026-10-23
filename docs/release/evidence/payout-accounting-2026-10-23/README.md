# Isolated Payout Accounting, 23 October 2026

Two original behavioral failures are retained: concurrent full-balance requests
both succeeded, and cumulative reversal credits stopped at 250 cents instead of
750 cents. The earlier harness-configuration failure is retained separately; it
executed neither behavioral assertion. The original backend source is recovered
from committed c1d2a2ff; the exact initial red-test source was not retained. The
expanded regression source and final implementation are retained with hashes.
One later archive-discovery failure is retained separately: executable test copies
were discovered as additional suites. Source snapshots now use `.txt` suffixes;
the repeated original command passes all 60 cases without discovering the copies.
Accepted reports require suite-level success, not only zero failed assertions.

After correction, 60 financial/journal/webhook cases and all 394 backend unit
cases pass. Five browser component checks pass across four widths. The browser
gateway is simulated separately from the emulator-backed callable tests: no
integrated browser-to-provider payment is claimed. The mobile action and its
status fit without table or page overflow. Four component screenshots are retained
for review, not published as actual financial transactions.

The provider boundary is replaced in the callable tests; no payment credentials
or real transfers are used. Callable handlers are invoked directly with synthetic
administrator claims; SDK transport and real sign-in are not proven. Firestore fixtures are removed after each test and
the disposable emulator shuts down. The browser blocks external origins and
closes its owned browser/server. No production deploy, real money, physical-phone
payment, GPS, notification delivery, native success or release acceptance is added.

## Separate Latest Native Recheck

The preceding c1d2a2ff native run 39988296119 is terminal **failed**. Its complete
matrix stops in the guardian-verification login wait. One focused team-conversation
case also stops in its login wait; the other nine individual focused cases pass.
The aggregate correctly fails. The original team instrumentation and restoration
receipts are retained. That restoration succeeds; this does not establish full-job
restoration or a cause for either timeout. The earlier successful fa0cc1ff replay
and completed physical notification/ride trials remain historical successes.

This is a newer blocker, not a reversal of those earlier observations. No retries
or increased native wait thresholds are added by the accounting correction.

See `summary.json`, the original result files, `source-sha256.json`, retained source
copies and `artifact-sha256.json`. The website keeps the previous payment-screen
capture dates and reports the new accounting result separately in its news.
