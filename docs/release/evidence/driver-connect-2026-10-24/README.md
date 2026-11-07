# Driver Account Preparation

Four Android Compose component cases completed on 24 October 2026 at the time
recorded in `layout/results.json`. The real shared screen/button components are
tested with local callback counters: repeated taps are blocked while opening,
the driver action is absent for a parent, a 320 dp layout with larger text fits,
and a deliberately wrapped command retains all its measured text.

The original unchanged three-case file first fails because the opening action
remains enabled. The same file then passes after the busy-state correction, but
its narrow capture is visually rejected: the second label line is clipped.
That successful-but-insufficient run remains in `green/`, unaltered and not
published. `layout/` contains the stronger four-case test and final original
captures, reviewed on 25 October. Only these two final captures are published.

The shared button replaces fixed height with a minimum height and vertical
padding. The account command is shorter, keeping its idle/opening states on
one line. The additional long-label case separately exercises wrapping rather
than concealing the original defect through shorter copy.

The payment-screen coordinator prevents overlapping account/link preparation,
checks the original user id, email and selected role after each suspension,
ignores late results for a different account, propagates cancellation, and
rejects unsafe links. Missing configuration produces a support message rather
than internal variable names. Opening a browser never claims verification,
onboarding completion or payout readiness. Screen-owned work cannot clear an
unrelated global loading state after navigation.

Two preceding corrected-app attempts stop before any component assertion with
startup ANRs. Their original results remain in `startup-failure/` and
`startup-failure-2/`. The latter trace observes DEX ZIP extraction and high CPU
pressure, alongside system-service ANRs. This does not establish a general
application or host root cause. The successful component runs compile the two
owned test packages ahead of time; this is explicitly not cold-start evidence.
The earlier missing-disposable-flag setup failure and verified package cleanup
also remain retained. No test is skipped or timeout weakened.

After the uncommitted working checkout disappeared, the nine exact executed
source snapshots were recovered by SHA-256 from the retained trial. The clean
base is 8c9851e55fc16216d9cfa6fad14bfb9fa4c36ffd. The app caller wiring is reapplied
and compiled. All 543 local unit cases are rerun on 25 October from the restored
sources with `--rerun-tasks`; the eleven coordinator cases and eight existing
payment cases, their full-suite XMLs and source hashes are retained separately
under `units/`. Their new date does not relabel the original device trial.

Every attempted component run removes its owned app/test packages. Current
device/process inspection is retained in `host-cleanup.json`; no natural exit
code is invented for the final host after its terminal handle was lost. No
personal device, administration, installation policy or location setting is
changed. All accounts/providers in these cases are local test doubles: zero
backend/provider requests, real onboarding, transfers or payments. iOS, physical
devices, cold restart, actual onboarding, fees policy and refunds remain open.
The app itself is not deployed by publishing the progress website.
