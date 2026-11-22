# Remote Completion Stops Background Tracking

The independent local native case passed on 19 October 2026 in 79.678 seconds:
run `e5fd4f7428ac698cffd53a4a0c9cced3`, one actual instrumentation test, exit 0.

The driver signs in and resumes the selected ride using the real local SDK and
synthetic fused-location input. The Activity task is backgrounded. A separate
authenticated driver session performs pickup, dropoff and completion through
the actual local callables. Before the same Activity resumes, the native service
is absent and the original driver is still signed in. An explicit task-return
intent then resumes that Activity; the UI shows no active ride.

The production fix gives the service its own authoritative Firestore lifecycle
watch. Completion, deletion, listener failure, driver replacement and child
removal stop the current lease. Cached documents neither authorize nor terminate
it. Superseded lease callbacks cannot stop a newer ride. The watch is removed on
replacement, stop and destruction. There is no new polling, retry or fallback.

## Isolation And Disposal

The completed ride, trip and booking, two audit events, exactly one zero-distance
impact record and unchanged driver claims were independently read back. Every
baseline flow record and every other live ride stayed unchanged; no reward was
created. The mock setting was restored, the SDK clients closed and only the two
local app packages removed. The owned runtime directory was destroyed after
these checks. Its CLI exited successfully and all four local endpoints refused
connections before the parent wrote the final report.

Six lifecycle-policy unit cases and eight lease-ownership cases are retained as
JUnit XML. The full Android unit command also passed: 394 tests, no failures,
errors or skips. Original earlier failures remain in the adjacent `before`,
`input-failure` and `resume-failure` directories; none is overwritten by this run.

## Visual And Release Limits

Both original screenshots were reviewed. Only the started screenshot is approved
for the portal. The ended screenshot correctly contains the no-active-ride state,
but omits bottom navigation, so it stays technical evidence only. This case does
not verify complete rendering, map movement, physical background or locked-screen
GPS, network loss, live providers, production safety audit acceptance or release
readiness. No production backend or app was deployed by this trial.

The preceding `d2b00e7` remote suite was not green: ordinary Android UI failed a
PixelCopy capture and its installation guard detected changed map runtime; web
smoke failed the SIGTERM supervisor check. That failed CI cannot be represented
by this independent native pass. Shutdown diagnostics now retain the original
error instead of only displaying a secondary exit-code assertion. These remote
failures require their own current-head verification.

No infrastructure resources or billing changes were made; Terraform is unchanged.
Web smoke validates these evidence boundaries. Native CI executes the new case
after the existing independent startup case, preserving earlier exit precedence.
