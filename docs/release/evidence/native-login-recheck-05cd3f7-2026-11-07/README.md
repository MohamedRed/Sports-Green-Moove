# Separate Android Failures

At source `05cd3f7`, run 42312780331 has two distinct failed jobs. Original
archive byte sizes and SHA-256 digests were checked against the remote artifact
metadata before retaining the allowlisted original members. See `summary.json`
and `original-archives.json`; neither failed result is a current-head pass.

The main job 128218021359 stops before app installation: 59 passive samples
never observe validated default Wi-Fi within the unchanged 180,000 ms budget.
Its earlier Android validation history records DNS failures. This does not prove
the cause of another job's failure, or a product defect, or a network repair.

The focused ride job 128218021570 executes one native case, which fails at
`LocalRideObservationFlowTest.kt:61`: the unchanged 60,000 ms Home-screen wait
after the login form. It never reaches the active-ride observer or its peer
operations. Authentication completion itself is unknown. The later process
exit is explicitly `due to finished inst`, not proof of a crash causing this
earlier failure. Device policy restoration, package removal and passive emulator
exit are verified independently, not treated as a flow pass.

The candidate observes the existing bounded activity/window mechanism before
ActivityScenario closes and retains only its typed lifecycle/window state and
a Boolean indicating whether the synthetic parent is authenticated. It adds no
text export, screenshot, network probe, authentication retry or setting change.
All original assertions, waits, captures and success-marker requirements remain.
The existing exception-safe wrapper rethrows the original failure even when
observation fails; its existing native regression cases remain in the suite.

The actual local emulator-configured Android test source compiles offline with
`:app:compileDebugAndroidTestKotlin` (complete log: `candidate-build.txt`). This is not native diagnostic execution or
acceptance of a corrected login/tracking flow. The next unchanged native run
is required. No production write, physical, payment, push or release evidence
is accepted, and no timeout, assertion threshold or release scope changes.

The public update is deliberately short. It preserves previous flow statuses,
dates, media, tours, successful checkpoints, failed history and public access.
The existing web and native observation contract now runs these additional
retained-evidence/source checks. No infrastructure change is needed.
