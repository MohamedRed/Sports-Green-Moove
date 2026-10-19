# Original Incomplete Native Startup Trial

Run `a6654a14403c265f8eb5c3bb56e2c273` passed its original native instrumentation
case and primary capture transfer. Duplicate startup/resume, invalid-point refusal
and sign-out were exercised with synthetic fused-location input. The host then
failed its isolated Firestore fixture cleanup with gRPC UNKNOWN; no positive
result was produced. This trial is not accepted end-to-end evidence.

Visual review also found the earlier failure message still present on the resumed
ride. The original test had not asserted that it cleared. That regression is now
covered by a stronger UI assertion and dedicated action-state unit tests. Original
source, transcript and images remain unchanged here. Local packages were removed
after the failure; the disposable backend runtime was shut down and removed.

The first runtime's emulator logs were not retained, so the cleanup root cause is
not established by this artifact. Subsequent independent trials retain sanitized
database/Firestore diagnostic logs before removing their runtime. A later pass
must not erase this original incomplete outcome or claim physical GPS proof.
