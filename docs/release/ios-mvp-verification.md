# iPhone MVP Verification

The owner confirmed Android **and iPhone** on 4 November 2026. No iOS release
requirements are removed. Existing routine iOS jobs remain disabled; the separate
`iOS MVP Verification` workflow checks the real SDK-linked Xcode project and
all fixture-screen tests on an isolated simulator: five original identifier checks
and two added search-consent cases. The later sign-out candidate adds a separate
profile-to-authentication case; it requires all eight cases, not a reduced selection.
The PR user-flow verifier requires this separate check to succeed: missing,
skipped, cancelled and failed runs are rejected. The old skipped routine lanes
are retained for their original cost policy, not used as iPhone proof.

The job runs only for a public repository on the standard `macos-26-intel` runner,
with read-only repository access and the approved 50-minute deadline. By default it uploads no artifacts,
uses no cache or provider secrets, does not sign, and does not publish an app.
[GitHub documents free standard public-repository compute](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
Larger runners and storage have separate billing; they are not enabled here.
The signature-only support concurrency check runs in addition to, never instead
of, the actual SDK-linked app build and all seven fixture tests.
The workflow builds the app and test bundles once with `build-for-testing`, then
runs every test from that build with `test-without-building`. These are separate
steps within the same deadline, with no reduced selection or second build.
The release manifest separately requires `ios_sdk_build_ci` and
`ios_fixture_ui_ci`; neither is accepted by a local signature check or a partial run.

At `3e7cd40`, run `41911781988` succeeds with the actual SDK build, all seven
fixture tests and simulator disposal. This includes the later account-refresh,
authentication, payment, publication, booking and permission-bridge source changes
in the compiled app, not end-to-end behavioral acceptance of those features.
At that checkpoint the manifest accepted only the two source-bound automated entries. No captures
are retained by this PR run; all physical and operational requirements remain.
See `evidence/ios-fixture-pass-3e7cd40-2026-11-04/`.

Later native-location shutdown changes keep authentication closed until the old
startup/upload callbacks actually settle and connect the profile sign-out button.
Their controlled local checks do not extend the earlier SDK/fixture acceptance.
Both automated entries are pending again until this changed source passes the
complete SDK-linked build and all eight fixture tests. See
`evidence/ios-location-shutdown-2026-11-04/`.

The first run at `c1c2fa4` failed in support gateway compilation before UI tests.
The candidate uses string-only inputs and validates Sendable models before
continuation transfer, preserving cancellation and account isolation. Full SDK
reverification remains required. See `evidence/ios-mvp-baseline-2026-11-04/`.

At source `01a2f058`, the SDK-linked app compiled, launched and executed all seven
tests: six passed and one failed because the fifth rating star was not exposed
under its expected identifier. Both search-consent tests passed. The combined
step was later cancelled; the job is not green, and simulator disposal succeeded.
The cause of the delayed test-process finalization is not established. See
`evidence/ios-fixture-observation-2026-11-04/` for immutable case-level evidence.
The rating controls now have explicit score labels, separate accessibility
containment and 44-point targets. At `5582299`, run `41854694392` passes its
separate SDK build and all seven fixture cases, including rating submission and
confirmation. Simulator disposal also passes. This proves the tested source, not
the later account-refresh code, physical journeys or complete app flows. See
`evidence/ios-fixture-pass-5582299-2026-11-04/`. Its recorded compiler warnings
remain separate from the successful build/test result.

A passing result would prove compilation against the declared SDK dependencies
and seven fixture-screen checks, not authentication, transactions, conversation
delivery, GPS safety scenarios, physical iPhone behavior or release readiness.
Failures remain failures; no automatic test retry or reduced test selection is used.

Local native logic checks passed on 4 November 2026 at source `6948862`. That
Foundation-only run is not an iOS app build. The local computer has Command Line
Tools but not full Xcode, so it cannot run the complete app or iPhone simulator.

Source review also identifies incomplete iPhone conversation actions and saved
emergency-contact management. These require implementation and behavioral proof;
existing identifier checks cannot accept them. Keep all physical, operational,
store and safety-audit evidence requirements open for both platforms.

The account-refresh race comparison in `evidence/ios-account-refresh-2026-11-04/`
reproduces late private data restoration after sign-out with the original AppState.
The candidate passes local checks for atomic snapshots, revocation, account/role
ABA transitions, response ordering and cancellation. This is not a completed
sign-out UI: its profile action, auth completion and tracking teardown remain open.
