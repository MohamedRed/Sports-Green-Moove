# Request Parser And Disposable Runtime Checks

28 October 2026. The installed server dependency resolves body-parser 1.20.5
through Firebase Functions and its actual Express dependency. No alternative
parser is substituted. The maintainer advisories identify patched 1.20.9:

- https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828
- https://github.com/expressjs/body-parser/security/advisories/GHSA-v422-hmwv-36x6
- https://github.com/expressjs/body-parser/blob/1.20.9/test/json.js

The retained nine-case test and worker sources run unchanged before and after
the update. Before: six passes and three failures. Invalid size configuration
does not throw; the two gzip trailing-byte cases independently terminate their
small loopback workers with an unhandled Gunzip Z_DATA_ERROR, including rejection
of an unsupported charset. This is a local dependency reproduction, not evidence
of an exploited production endpoint or an out-of-memory attack.

After: all nine pass. Normal JSON/gzip still decode, oversized decoded bodies
return 413, malformed JSON returns 400, trailing deflate bytes finish the request
and preserve a separate raw-body hash, and the two gzip workers survive their
post-response error window. Each child is bounded to five seconds; the largest
synthetic request is below 103,000 bytes. No catch-all process error handler,
disabled compression, middleware workaround, forced downgrade or retry is added.

Only six lock entries change: the two installed parser lines and their required
content-type, iconv-lite and qs dependencies. Existing direct package ranges and
all other lock entries stay identical. The development-only parser becomes 2.4.0
within its existing range; the production parser stays on its 1.x line. The audit
no longer reports body-parser but still has 21 findings, down from 22. All 501
backend unit cases and the Functions/admin/website builds pass locally.

## Service Replay And Disposal

The first compatibility replay passes 21/24 groups, then loses its callable
server. The consent denial assertion and the following application/supplement
groups fail. Its CLI exits 2 and the outer command exits 1. Two detached Java
processes still listen on 8080/9000 even though the runtime directory was removed.
Their working directory and identity were observed before explicitly sending
SIGTERM to only those two owned PIDs. All three observed PIDs are subsequently
absent and four endpoints pass independent bind/close checks. The original
partial result, failure excerpt and manual disposal receipt remain retained.

Disk pressure was also observed; the precise cause of that CLI exit is not proven.
The local runtime now limits each emulator JVM to -Xms64m -Xmx512m, without changing
the user's shell, production infrastructure or provider configuration. Its cleanup
now verifies endpoint closure in a separate bounded process before removing a
launched runtime. A live endpoint or failed verification retains the directory
and diagnostics; it does not kill an unowned listener or claim successful cleanup.
Five actual disposal checks cover live/closed endpoints, failed verification,
symlink rejection and arming the guard. They do not prove all possible detached
processes are automatically stopped.

The fresh bounded replay passes all 24 existing groups, including parent consent,
application, synthetic supplement reconciliation, cancellation races, messaging
and ride lifecycle. It exits 0; the guarded runtime removal returns successfully
and an independent final bind/close check confirms all four endpoints are free.
This later pass neither erases the first failure nor proves its precise cause.

No physical-device result, provider map request, real payment, production
deployment, full security clearance or release completion follows from these
checks. The separate phone application trial still needs its own map allowance
and actual UI evidence. The preliminary seven-case receipt is kept separately;
it predates the two crash cases and is not the unchanged nine-case comparison.

Validate with `node --test tests/http-body-parser-security.test.mjs tests/http-body-parser-evidence.test.mjs tests/local-runtime-disposal.test.mjs`.
