# Lost Response After Message Commit

`results.json` is the unmodified final output from `npm run test:local-flows`:
run `0ab00e5e7949d11752e4d6912454cd31`, 2026-10-16T12:24:21.639Z.
All 18 isolated service groups passed and the runtime exited successfully.
`first-pass.json` retains an earlier 18-group pass, run
`9cf7f0dae88cfa970f942b54694f2ee3`, 2026-10-16T12:22:32.738Z.
Only the final run accepts the final helper, including its tightened JSON
setup-failure response. No production application or backend code was changed.

## Fault And Observations

The suite creates a new trip and approved booking through authenticated local
calls. A loopback-only HTTP proxy forwards the parent's first send to the actual
isolated `sendChatMessage` function. After the function returns HTTP 200, an
independent database check requires the exact message, sender, request UUID,
content, one correctly addressed unread notification and original creation time.
Only then does the proxy destroy its downstream response without sending headers.

The sender uses Node's HTTP client with no automatic retry. It must receive
`ECONNRESET` with `responseReceived: false`; the proxy must have forwarded exactly
one request at that point. An ordinary timeout, rejected upstream request, or
failed independent commit check cannot count as the intended fault.

Two explicit retries reuse the same sender, booking, body and request UUID. Both
return the original message ID. A different body under that UUID returns HTTP
409/`ALREADY_EXISTS`. An unrelated authenticated account is denied. Final checks
still require one message, its unchanged ID/request/content/creation time, and
the same single notification. The driver reads that record, leaving zero unread
count. The receipt contains no tokens, passwords, live-provider or real-user data.

The helper is restricted to the exact demo-project loopback send endpoint. Both
upstream and client HTTP operations are bounded. Its owned loopback listener is
closed in `finally`; no system network setting or Android process is changed.
Focused unit tests separately prove that failed commit verification returns a
setup error rather than manufacturing a dropped acknowledgement.

## Scope

This verifies service-level HTTP response-loss idempotency, not a native retry
screen. The native composer, retained pending request identity, process death,
expired credentials, physical phones and push delivery are not covered here.
There is no new recording or screenshot: existing app captures must not be
presented as a visual demonstration of this transport fault. The private portal
retains its completed native restart evidence separately and adds this result
only to its local service checks. Full release manifests remain unchanged.
