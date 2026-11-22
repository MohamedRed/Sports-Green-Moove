# Team Screen Execution And Export Failure

Original run: [Native CI 39164543537](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39164543537)
at `9c9d94659c196b24cd6f1005ec4f8f8f07865953` on October 18, 2026.

`ordinary-tests.xml` contains 143 cases, 33 skipped, no failures/errors. All four
`TeamEnrollmentFlowTest` cases executed successfully: explicit confirmation,
child selection, read-only recovery after an uncertain reply and confirmed
withdrawal with a 320dp / 1.3 font-scale layout. These use simulated responses,
not SDK-connected enrollment. `TeamEnrollmentFlowTest.before.kt` preserves the
exact executed source and the older build report's original source binding.

`local-replay.json` separately contains 35 passed groups / 37 instrumented cases.
It does not contain the team enrollment component cases. Its primary evidence
transfers succeeded in this run; this is not a whole native-job pass.

The job failed because the team capture directory yielded zero files. The raw
`native-suite-status.json` retains ordinaryTests=0, componentEvidence=1 and
localReplay=0. `disposable-store-restore.json` reports restored/verified=true.
No new team image was recovered or published. Existing reviewed images are not
relabelled as new team proof. No release-manifest item is accepted by this run.

Root cause: the capture helper wrapped already whitespace-free paths in single
quotes. Android's command bridge invokes `Runtime.exec(String)`, not a shell,
so quotes become literal path characters. Empty stdout did not prove success.
See [Android command bridge source](https://android.googlesource.com/platform/frameworks/base/+/330dc32a01316b5e31c4ea5afdf834cb0497f057/core/java/android/app/UiAutomationConnection.java).

The helper now validates its generated source path, exports without shell
quoting and compares the destination SHA-256 with the actual captured bytes.
The CI collector still requires all four original files; no cleanup copy,
alternate directory, retry, timeout increase or skipped requirement substitutes
them. Compilation alone does not accept the corrected export. A fresh complete
native run and visual review of recovered captures remain required.
