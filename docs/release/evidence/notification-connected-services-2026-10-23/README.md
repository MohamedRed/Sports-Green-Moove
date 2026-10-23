# Authenticated Notification Service Checks

23 October 2026. Source `87082b10b44db59943089a21f82606f5a153be2b`.

Four scenarios executed through the actual authenticated local callable transport,
not direct handler invocation or simulated UI gateways. Approval and cancellation
actions create real isolated notification records. The parent acknowledges one;
the other parent notice and driver notice remain unread. Fresh inbox reads stay
scoped to each account, foreign writes are refused, and an explicit replay keeps
the first server read timestamp unchanged.

Independent checks protect 167 records, all account claims and live-trip data.
Only the selected notice's read fields may change. The device version also allows
the selected parent/driver profile initialization timestamps to advance. The
owned local environment was destroyed and all four endpoints were independently
confirmed closed. All 1821 root tests pass; the two new native restart stages
compile but have not executed in this service evidence.

The initial fixture incorrectly assumed a driver notification existed for a new
booking request. That event is not implemented. The corrected fixture uses the
existing cancellation notification without changing product behavior. Initial
source-contract failures pinned the previous 36-group/38-case matrix; the new
37-group/40-case matrix preserves every preceding group. Historical run counts
are not changed.

Separate preceding CI evidence: run 40008087430 on `c3403d0c` is terminal and
failed, although its full native UI job passed. Focused session-restoration job
120601047686 failed while downloading the emulator package with `Error on ZipFile
unknown archive`, before the app launched. Its aggregate failed too. The retained
excerpt is restricted to download/preparation errors. This does not establish
the download's underlying cause, another application defect, or successful cleanup
of a phone that was never launched. No retry or fallback was added.

No connected native notification flow, physical-phone result, public capture,
push delivery, production mutation or release acceptance is claimed here.
