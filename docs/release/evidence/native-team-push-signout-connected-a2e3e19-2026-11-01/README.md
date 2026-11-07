# Connected Native Sign-Out - 1 November 2026

The completed isolated `team-conversation` job at source `a2e3e19` passes its one
native case, keeping all nine original team checkpoints. The real app's driver
logout also returns to the login UI after authenticated removal is acknowledged.
Auth is absent afterwards; durable logout intent remains. An independent local
admin read confirms one inactive registration and no token index.

This uses actual local auth/callable services but an explicitly **synthetic**
messaging token. It does not call the real messaging SDK, prove token deletion,
deliver/display/tap a notification, test process death on a phone, or accept any
release requirement. The activation receipt is not independently re-read.

The downloaded ZIP matches artifact `13091247720`'s advertised SHA-256 exactly;
each selected entry matches that ZIP. All 57 critical source hashes match the
tested commit and are archived. Copy and device-restoration receipts pass; the
owned local services/data are removed. No new public media is added. This focused
pass is separate from the still-running full workflow at the time of collection.
