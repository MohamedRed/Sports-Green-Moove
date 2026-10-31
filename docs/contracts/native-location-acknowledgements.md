# Native Tracking Startup Acknowledgements

`writeLocationBatch` still reports actual committed writes as `written`, with
every non-commit counted as `ignored`. It additionally returns one ordered receipt
per submitted update: ride id, driver/child role, submitted capture time and one
of `written`, `retained` or `invalid`. Authentication, role and active-ride access
are checked for the entire request before any location transaction begins.

A retained receipt means a valid capture was not newer than the stored valid
observation. It does not mean the submitted coordinates were saved, that a new
point was produced, or that the position is fresh. Invalid/future timestamps have
a distinct negative receipt. The receipt is selected inside the same Realtime
Database transaction callback that evaluates monotonic ordering, including clock
reevaluation on contention. Database failures do not become acknowledgements.
The existing shared writer's boolean interface remains actual-commit-only for
provider-event reconciliation and other administrative callers.

Android tracking startup submits one acquired fused-location point and requires
one receipt matching its ride, role and exact safe-integer capture time. Counts
must be integral and consistent with the receipt. A written or retained result
permits starting the foreground service. Invalid, unknown, missing, mixed or
contradictory results do not. There is no count-only compatibility path. The
authenticated owner and tracking authorization revision are checked before upload
and again before service start. Acquisition failures still require an explicit
user action; no cached/provider substitution or automatic retry is added.

This fixes an integration mismatch: monotonic storage correctly ignores duplicate
captures, while the former startup code rejected any zero-write response even
when a valid stored position already existed. Fused location can legitimately
return a recent cached position, as described in the official SDK reference:
https://developers.google.com/android/reference/com/google/android/gms/location/FusedLocationProviderClient

The independent `test:native-tracking-startup` scenario uses a disposable local
Android device, real app/SDK/callable calls and synthetic fused-location inputs.
It requires startup and explicit resume with an already stored point, refusal of
a future capture without starting sensing, and service stop on sign-out. The
original instrumentation result, primary capture copy, stored-state checks and
test-only permission restoration must all pass before its host writes a positive
report. This does not prove physical GPS, provider delivery, maps, actual network
loss, locked/background tracking or any final release evidence requirement.

The user approved destroying this test's entire disposable local runtime instead
of deleting its rows individually. Before teardown, a read-only isolation check
requires the baseline flow records and every other live ride to be unchanged.
The child emits only an application-check candidate. The owning runner writes a
positive report only after the emulator CLI exits successfully, its own temporary
directory is removed, and all four local service endpoints are closed. This is
the sole cleanup policy for this independent case, not a fallback after a failed
delete. Earlier failed per-record cleanup trials remain negative evidence.

The synthetic sensor emits repeatedly with an immutable submitted capture time,
so slower authenticated reads cannot turn the test into a one-shot cache-age
experiment. Sensor errors and bounded sensor shutdown failures fail the case.
Each primary image is copied once from the synchronized application window after
a frame commit, with a bounded PixelCopy callback and no alternate capture path.
Blank images or changed expected screens are rejected. Incomplete images remain
excluded from the curated portal set. The retained functional report explicitly
keeps visual completeness unverified; two of its four images show missing
navigation despite passing application assertions and later navigation.

The matching backend must be deployed and verified before distributing this
client. Older clients still receive the original count fields; the updated client
deliberately refuses a server that does not acknowledge the individual point.
