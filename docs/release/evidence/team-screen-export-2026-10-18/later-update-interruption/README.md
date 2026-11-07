# Later Native Run Interrupted During A Runtime Update

[Native CI 39169228498](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39169228498)
failed at source `8be7c88c14b3e2969cece4702b143cd9c9edc982`. This was an
evidence/portal-only update after the successful `0cb8e4c` native run; application
and test-device execution code was unchanged.

The raw ordinary XML contains 135 discovered cases, 33 skips and one reported
failure; instrumentation ended with `Process crashed` during
`TripChangeFlowTest.refreshRecoversAStoredProposalWithoutAnotherWriteWhenBothRepliesWereLost`.
All four team enrollment component cases had executed without a case failure.
These do not make the interrupted ordinary suite successful.

The setup receipt records service version `24.23.35`. The typed package journal
records an applied `com.google.android.gms` installation during the run. The CI
restore diagnostic observes `26.40.32`, and the raw restore receipt preserves
`restored=true, verified=false`; no runtime-preservation claim is accepted.
The crash and update coincide, but the retained package journal is not by itself
a conclusive process-exit cause.

`local-replay.json` separately contains 35 passed groups / 37 instrumented cases
for `5b669b9e0446f855c469e86a35d5a66b`. The raw suite receipt still has
`ordinaryTests=1, componentEvidence=0, localReplay=0`. That later local pass cannot
replace the original ordinary failure or failed runtime verification.

Six original artifacts are hashed, including the original failure XML and
restore receipt. The successful capture proof remains unchanged in `../completed/`.
No current whole-job pass, physical-device result or release evidence is accepted.
Stronger temporary installation/update restrictions remain awaiting the user's
approval; none have been applied. Existing maps and location remain enabled.
