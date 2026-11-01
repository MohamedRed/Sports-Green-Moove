# Native Sign-Out Ordering and Durable Intent — 1 November 2026

The source-bound local build passes 770 JVM cases in 113 suites, including 79
focused registration/exit cases. App and instrumentation APKs compile with local
services only; messaging auto-init, delegation and the local messaging service
remain disabled. No provider sends, map requests or production writes occur.

Online removal now starts before auth is cleared, with a 2.5-second bound. Forced
local cleanup always runs, even after timeout/cancellation. A strict v2 journal
retains logout intent across reconstruction and remote acknowledgement; only
verified explicit sign-in clears it. The known v1 schema migrates without losing
identity/revision/pending data. Corrupt or unknown schemas do not reset.

The private account/login form are hidden during exit; duplicate taps are ignored.
Three native UI cases and a synthetic-token local connected contract compile,
but are **not executed by this JVM/build proof**. Actual SDK token deletion,
authenticated phone removal, closed-app delivery/display/tap and release readiness
remain unverified. This record does not replace later device or workflow evidence.
