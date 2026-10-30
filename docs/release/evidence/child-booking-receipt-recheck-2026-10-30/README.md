# Child booking receipt recovery, 30 October 2026

Seven genuine local-service checks pass for a new, free, four-seat fixture trip,
one synthetic child and two requested seats. The actual booking callable commits
one request, immutable receipt and driver notice before a loopback test proxy
discards the real reply. An unconfirmed repeat is blocked without forwarding.
The parent reads the original pending child booking through the reservation
callable, including after fresh authentication, without submitting again. One
explicit retry returns the original genuine receipt (`reused:true`). A foreign
parent cannot list or replay it. All captured top-level documents, account claims
and live-trip data remain identical except those three owned new records. The
trip remains at four available seats because it is not yet approved.

This is **not** search UI, process restart, a physical-phone run, radio loss,
payment, production or release evidence. No map/provider requests occur. No app
runtime code is changed; the QA harness's working-tree bytes are hashed before
and after execution and archived. The existing adult-only proxy contract remains
the default; only an explicit, validated child target enables two-seat payloads.
Changed passengers, seats, owners, trip identity and retry identity fail closed.

An earlier local observer attempt is retained as failed: it incorrectly looked
for `id` instead of the reservation callable's `bookingId`. Two checks had passed;
the history assertion did not. This was a new test-observer contract error, not
an application defect. The corrected observer validates the real DTO and rejects
the invented `id` shape. An even earlier launch stopped before the suite because
the shell selected an old Java runtime. The successful run uses the already
installed Java 21. Failed attempts are not promoted or overwritten.

The completed command closes both independent admin clients, its proxy and the
emulator processes; the owned runtime directory is removed and all four local
service ports are verified closed. `cleanup.json` is separate from application
evidence and does not claim phone disposal. No new public image or video is added.
Earlier phone galleries and dates remain unchanged. The child/search phone
restart scenario still requires its own test and a fresh bounded map allowance.

## Independent Current-Source CI Failures

At app source `ef8b99810e45cf126f31e416e22404bcb9f1b7c3`, the focused chat job
in [Native run 41091421741](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41091421741)
is terminal failure. It times out during **network preparation**, before any
handover, offline interval or resend. Read-only observations show validated
cellular transport and unvalidated Wi-Fi; retained Wi-Fi validation history
contains DNS-resolution failures. These are separate sampled observations, not
proof of a general provider defect or an application chat failure. Callback
requests are released and disposable-device restoration verifies successfully.

The same-source main UI job succeeds separately: 205 ordinary cases pass, 54 are
skipped, all 37 integrated groups / 40 native cases pass, and 17 primary copies
complete. Its chat trial begins on validated Wi-Fi and completes. The focused
failure began on validated cellular transport with unvalidated Wi-Fi. These are
different virtual devices; neither comparison proves a repair, nor that merely
waiting would cure the failure. Overall Native CI remains failed, not green.

Separately, [generated-file transport run 41091421917](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41091421917)
fails its 29th primary transfer after 28 integrity-verified copies, out of 32
planned. No app or account was involved, no retry or alternate transport used.
The remote test-file cleanup and absence checks are explicitly **not verified**.
This narrows the failure's scope but does not establish its cause or fix it.

All selected artifacts are checksummed. Original fixture/service data contains no
authentication tokens or passwords. Sources for accepted local checks and the
selected diagnostics are separately archived. Web Integration Smoke adds the
seven-check service trial to its existing people/safety group and retains its
trial plus cleanup result; all 111 original workload steps remain unchanged.
