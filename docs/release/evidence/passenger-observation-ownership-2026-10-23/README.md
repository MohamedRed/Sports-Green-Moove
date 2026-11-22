# Passenger Command / Observation Ownership

23 October 2026. Baseline: 7c7bb699dfd59b5a66ef1a7656296da26c9bdddc.

Two deterministic Android unit regressions reproduce a genuine state race with
the unmodified production command: its one-shot `getActiveRide` publishes the
confirmed pickup/dropoff, then the live observer's next one-second age tick
replaces it with its older passenger snapshot. Both red failures retain the
expected confirmed status and actual pending status in their original XML.

The correction removes that competing read and its setter from the passenger
command and app call site. The existing live observer receives the server update
and owns passenger publication; command loading, errors and success notices stay
intact. The obsolete read/setter is removed rather than kept as a fallback.

Both regressions then pass, together with six observation tests and nine app-state
tests (17 targeted cases). The full Android unit suite passes all 497 cases in
78 suites, without skips. The Android instrumentation APK compiles. Original
Gradle transcripts and JUnit XML are retained, along with source fingerprints and
content-addressed original source files.

No UI deadline, test assertion, pickup/dropoff rule or end-ride safety gate is
relaxed. The original LocalRideFlowTest remains unchanged. This unit reproduction
is consistent with the earlier disabled end-ride action, but the exact timing of
run 39960012671 is not proven by its limited log. A complete native replay is
still required; these tests are not native execution, a physical phone trial,
real GPS/network evidence, a deployed application fix or release acceptance.
