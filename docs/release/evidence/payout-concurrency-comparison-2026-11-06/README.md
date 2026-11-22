# Payout concurrency comparison

Verified locally on 6 November 2026 against the isolated Firestore emulator.
No provider transfer, real account or payment was used.

The original backend failure is retained at run 42273698377, job 128084474705,
source `9640d8b65db123e753d1577eebd2e67595f16058`. The concurrent requests returned
the same result and posted one debit. Only the JSON-string comparison of their
internal operation objects failed. A newly reserved operation and a reloaded,
schema-parsed operation have different property insertion order. That is not a
difference in payment terms or provider request parameters.

The regression now holds both synthetic provider responses until both requests
have arrived. This forces the in-flight replay path rather than allowing a fast
completed replay to bypass the comparison. Both promises are settled before
test cleanup, including assertion failures.

With this barrier and the original string comparison, the four-file payment
suite reproduced the failure: 77 passed, 1 failed. With semantic equality of the
complete operation objects and exact equality of the actual request builder's
outputs, all 78 passed. The expected request explicitly checks amount, currency,
destination, metadata and idempotency key. The single immutable debit and equal
call results remain required. No production payment behavior was changed.

`npm run test:stripe-webhook-flow` already runs in both Backend CI and Web
Integration Smoke, whose path filters already include this test. No workflow,
test-case count, timeout, provider configuration or release acceptance changed.
Local regression success is not live payment or release-readiness evidence.

Final local verification: all 78 payment-flow cases and all 623 backend unit
cases passed. The emulator shut down cleanly after both the negative reproduction
and the final successful run.
