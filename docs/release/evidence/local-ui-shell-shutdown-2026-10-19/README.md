# Local Session Signal Delivery

Web smoke run 39313165720 at 67ab59ca132db1754b3236f97284ce48d5bc022f
failed its actual SIGINT shutdown trial. The original CLI log reported its script
exiting by SIGINT and the supervisor returning 1 rather than 130. Backend CI at
that source succeeded. This is not a new app-flow failure or a completed release.

The installed CLI starts entry commands with `shell: true`. A waiting shell can
receive the process-group signal independently of the entry's signal handlers.
The launcher now uses POSIX `exec` with literal, single-quoted paths, replacing
that shell with the entry process. Actual shell tests check PID identity and both
signals. Nonzero service exits, simultaneous failures and orphaned workers still
fail the unchanged supervisor checks; no alternate exit code is accepted.

The subsequent actual local service trial passed both SIGINT and SIGTERM using
Java 21. Its original `services.json` records exit codes 130/143, private-session
removal, all four service shutdown events and refused loopback ports. Six source
bindings have byte-identical originals in the source archive. This is macOS
service-process evidence, not Linux verification, phone UI, GPS or payment proof.
The preceding Java-precondition refusal is retained separately; it ran no signal
scenario. The original remote SIGINT failure remains unchanged.

An independent fresh Android 15 store-image preparation also stopped before
installing the helper: the device had no owner or helper after the attempt, and
the returned store cleanup reported restored settings but failed verification.
Its original receipt does not retain the initiating admin-preparation error, so
it cannot establish that error's precise cause. Setup now attaches a typed stage
for readiness/provisioning failures, including failures before helper installation.
Those diagnostic changes have unit coverage but need their own device execution.
The owned emulator was stopped; no app-flow or map success is claimed here.

The final root suite passes 801 tests without failures, cancellations or skips.
The portal overview was reviewed at desktop and mobile sizes; its existing
visual catalogue checks passed. These checks do not replace native execution.

The current complete native run remains separate. Physical tracking, actual map
movement, child contact access, team chat, provider payments and safety-audit
evidence remain open. No production deployment or release acceptance occurred.
