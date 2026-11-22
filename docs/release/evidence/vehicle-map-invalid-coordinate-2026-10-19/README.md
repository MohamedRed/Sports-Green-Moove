# Original Invalid Coordinate Acceptance

The first authenticated trial expected `writeLocationBatch` to reject latitude 91
with INVALID_ARGUMENT. It did not, and the assertion failed. The original
transcript and executed trial/schema sources are retained. No success report
was produced for that run; no persisted invalid coordinate is inferred from
this transcript. A subsequent build-only TypeScript failure was repaired before
the successful new run; it supplied no runtime evidence.

The fix enforces geographic limits at request parsing for both supported batch
forms and at the shared atomic writer. Tests retain the original acknowledgement
assertions with a valid stored-coordinate fixture and add invalid-coordinate
receipt cases. No assertion was relaxed to accept the original defect.
