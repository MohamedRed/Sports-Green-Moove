# Isolated Support Submission Recovery

22 October 2026. These are **separate service and native component checks**, not
a connected physical-phone or production flow. All source snapshots and raw
artifacts are checksum-bound. The APKs were built from a dirty tree based on
`f819e9b0`; no clean-commit build claim is made.

Twelve real isolated service scenarios pass, including concurrent identical
sends, changed identity reuse, current-account enforcement, urgent-flag readback,
private operation access and exact retry after a deliberately dropped response.
The fault proxy first receives HTTP 200, independently verifies the stored report
and private operation, then destroys the response. One explicit retry returns the
original report. Nineteen protected fixtures and original claims stay unchanged.
The existing thirteen written-response service scenarios also pass again.

Two executed Android component cases use the **real file store and simulated
in-process transport** on an API 35 emulator. They check immutable pending input,
screen-state recreation without automatic resend, explicit retry, urgent-choice
retention, and fail-closed corrupt storage. They do not connect that screen to the
tested service, restart the app process or prove a physical-phone network loss.
Twelve JVM cases and local Swift model/state checks pass; the Swift package builds
without the Firebase SDK linkage. There is no iOS physical UI claim.

Four untouched full-screen PNGs are reviewed. The pending and restored images
have identical pixels, as expected when the recreated screen restores its exact
content; the executed assertions distinguish their state lifetimes. The original
screen recording is retained. The portal uses only seconds 10–20 at normal speed,
without audio. Recording-only 1.2-second pauses after successful assertions make
the actual UI states readable. No frames were generated or reconstructed.
The initial unpaced recording and missing-runner command failure remain retained,
not promoted as successful new evidence.

Both installed packages are removed, the owned emulator is stopped and its new
AVD is deleted. The isolated backend ports are closed. No administration policy,
personal device, production account, payment or paid provider was changed.

The prior source's full Native CI remains failed: its log reports a transfer
failure during `trip-change-schedule`. The underlying cause is not established.
This local support success does not supersede that global gate or accept physical
tracking, emergency escalation, push, payment or safety-audit requirements.

New clients call only `submitSupportReport`; they never fall back to `createReport`.
The old callable is intentionally unchanged because installed builds still use it.
Neither the new callable nor apps are deployed to production. This portal snapshot
is prepared locally and not published while owner-private access remains unresolved.
