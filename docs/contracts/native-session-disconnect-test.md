# Disconnect From A Failed Session, Then Restart

The first restoration trial proves Retry with actual local SDK calls, but does
not click Disconnect. The separate focused `session-disconnect` trial uses its
own fresh disposable device, the existing local synthetic parent and the same
controlled callable-rejection proxy. No production app gateway is replaced.

Its first native method signs the parent in through the SDK and real local
profile callable, then directs restoration to the loopback proxy. One controlled
503 must leave the actual error screen visible, with the SDK parent still signed
in and neither Home nor login visible. The test presses the real Disconnect
action. Only then may the SDK identity become empty and the sign-in screen open.
The diagnostic detail must never appear in the user-facing error.

A private success checkpoint and original before/action images persist in the
owned app's data. The host validates the isolated session and checkpoint before
issuing force-stop for exactly `be.sportgreenmoove.app.local`; process inventory
must then be empty. It never clears data or reinstalls the app between methods.

The second native method must have a different process ID and find the Auth SDK
already signed out before MainActivity launches. The actual app must show login,
not Home or the earlier restoration error, and remain signed out. Three original
captures, two instrumentation transcripts, the checkpoint, force-stop receipt and
native final marker are required. The proxy must record exactly one rejected
profile request, no recovery phase, and no subsequent request from this flow.

Both methods retain continuous installation blocking. All top-level fixture
collections, claims and live trips must stay unchanged apart from the parent's
expected profile timestamp. Independent proxy/admin/app/runtime cleanup is
mandatory, including closure of local endpoints and removal of the temporary
device administrator. Cleanup cannot overwrite an earlier test failure.

Compilation and synthetic checkpoint tests are preparation only. Acceptance
requires actual terminal native execution, original artifact verification and
visual review. This is not physical network-loss, child-account, active-ride
tracking, provider, payment, store-review or safety-audit evidence. Previous
four/five-case reports retain their own original source and scope.
