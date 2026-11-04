# iPhone MVP Verification

The owner confirmed Android **and iPhone** on 4 November 2026. No iOS release
requirements are removed. Existing routine iOS jobs remain disabled; the separate
`iOS MVP Verification` workflow checks the real SDK-linked Xcode project and its
five existing fixture-screen tests on an isolated simulator.
The PR user-flow verifier requires this separate check to succeed: missing,
skipped, cancelled and failed runs are rejected. The old skipped routine lanes
are retained for their original cost policy, not used as iPhone proof.

The job runs only for a public repository on the standard `macos-26-intel` runner,
with read-only repository access and a 35-minute deadline. It uploads no artifacts,
uses no cache or provider secrets, does not sign, and does not publish an app.
[GitHub documents free standard public-repository compute](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
Larger runners and storage have separate billing; they are not enabled here.

A passing result would prove compilation against the declared SDK dependencies
and five fixture-screen checks, not authentication, transactions, conversation
delivery, GPS safety scenarios, physical iPhone behavior or release readiness.
Failures remain failures; no automatic test retry or reduced test selection is used.

Local native logic checks passed on 4 November 2026 at source `6948862`. That
Foundation-only run is not an iOS app build. The local computer has Command Line
Tools but not full Xcode, so it cannot run the complete app or iPhone simulator.

Source review also identifies incomplete iPhone conversation actions and saved
emergency-contact management. These require implementation and behavioral proof;
existing identifier checks cannot accept them. Keep all physical, operational,
store and safety-audit evidence requirements open for both platforms.
