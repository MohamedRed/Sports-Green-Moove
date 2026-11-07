# iPhone MVP Verification

The owner confirmed Android **and iPhone** on 4 November 2026. No iOS release
requirements are removed. Existing routine iOS jobs remain disabled; the separate
`iOS MVP Verification` workflow checks the real SDK-linked Xcode project and
all eleven fixture-screen tests on an isolated simulator: five original identifier
checks, two search-consent cases, one profile sign-out case, two emergency-contact
cases and one parent contact-selection case. No reduced selection is accepted.
The PR user-flow verifier requires this separate check to succeed: missing,
skipped, cancelled and failed runs are rejected. The old skipped routine lanes
are retained for their original cost policy, not used as iPhone proof.

The current candidate runs only for a public repository on the standard `macos-26` ARM runner,
with read-only repository access and the approved 50-minute deadline. By default it uploads no artifacts,
uses no cache or provider secrets, does not sign, and does not publish an app.
[GitHub documents free standard public-repository compute](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
Larger runners and storage have separate billing; they are not enabled here.
Older live runs keep their original Intel runner. The architecture change is a
performance candidate, not an accepted improvement; cases, deadline and capture
bounds are unchanged. See `evidence/verification-boundaries-2026-11-05/`.
The signature-only support concurrency check runs in addition to, never instead
of, the actual SDK-linked app build and all eleven fixture tests.
The workflow builds the app and test bundles once with `build-for-testing`, then
runs every test from that build with `test-without-building`. These are separate
steps within the same deadline, with no reduced selection or second build.
The release manifest separately requires `ios_sdk_build_ci` and
`ios_fixture_ui_ci`; neither is accepted by a local signature check or a partial run.

## Current Proof And Historical Results

At source dd09f35, run 42315882640/job 128229229902, the SDK build succeeds
and all eleven cases execute: nine pass, two fail with three assertion failures.
The parent directory opens, but its cancellation button inherits the row's
identifier in the actual accessibility snapshot. The candidate adds explicit
row containment, preserving every action, guard and test assertion. The other
failure retains the earlier Connect-label query; its stable-command candidate
already exists. Both pending iPhone entries retain this later result. Corrected
SDK/screen comparison and all wider release requirements remain open. See
`evidence/ios-parent-row-2026-11-07/`.

At source 05cd3f7, run 42312780272/job 128220001036, the SDK build succeeds
and all eleven cases run: ten pass, one assertion fails in the added rewards
check. The payments screen opens; its next query expects the original mixed-case
label although the shared real button renders uppercase. A stable identifier
candidate preserves the action/text/driver branch and now checks the actual
command and enabled state. Corrected SDK/UI remains pending, including the newer
parent reservation sequence. No runtime cause or release acceptance is inferred.
See `evidence/ios-connect-selector-2026-11-07/`.

The later parent reservation directory reads only the authenticated parent's
paginated reservations and supports explicitly confirmed, server-authorized
cancellation. Controlled native state/decoder/signature and actual scripted
adapter checks pass. The existing booking fixture gains a paginated parent
cancellation/history sequence; all eleven cases, 50 minutes and capture bounds
remain. SDK and screen execution for this source remain pending. Earlier screen
successes are historical, not acceptance of this new directory. See
`evidence/ios-parent-reservations-2026-11-06/`.

The eleven fixture cases are not a complete platform feature audit. Separate
iPhone implementations/replays are still needed for driver trip changes and
cancellation, parent proposal confirmation, guardian-verification requests and
team enrollment. Closed-app push, real-service transactions and physical safety
scenarios also remain open. Existing web management review does not imply native
parent entry points. None of these requirements is waived by a green fixture job.

The later reward-navigation change replaces an empty rewards button action with
the existing owned driver payment-settings route. Local native checks pass for
granted, denied and stale actions without provider calls or transfers. The
original secondary-screen case gains navigation and refusal assertions; all
eleven cases and the 50-minute deadline remain. Both automated entries are
pending again for these changed inputs. The d3 success below is retained as
historical, not inherited as current acceptance. See
`evidence/ios-reward-navigation-2026-11-06/`.

At `d3c0f7a`, run `42305150736`, job `128192527345`, the SDK-linked build and
all eleven original screen cases pass, including parent invitation and child
code. Disposal succeeds and no artifacts are retained. Exact current build
inputs and workflow match; only the two automated iPhone entries are accepted.
The cc1 failure remains unchanged in history. This corrected UI observation does
not establish the sole cause or repeatability, nor accept physical, operational,
live-service or release requirements. See
`evidence/ios-fixture-gate-d3c0f7a-2026-11-06/`.

The later source `9640d8b` recheck, run `42273698326`, job `128084923176`,
builds successfully and executes all eleven cases: ten pass; membership approval
is absent after selecting the review club. Its cause remains unconfirmed.
Disposal succeeds, optional captures are skipped and artifacts are empty. Only
the two combined automated iPhone entries are reopened; all earlier successes
and other release requirements remain. Bounded failure-only diagnosis does not
accept a fix, change the original assertions or extend the 50-minute deadline.
See `evidence/ios-fixture-recheck-9640d8b-2026-11-06/`.

At `f61e0f7`, workflow `42116135548`, job `127556161432`, passes the SDK build,
all eleven original screen cases and disposal. Captures are skipped and artifacts
are empty. At that checkpoint, exact source/config/resource inputs matched and
the two automated iPhone entries were accepted. This includes the bounded full-input
observations added after d56. Physical, operational, emergency phone handoff,
live-service and complete release requirements remain open. See
`evidence/ios-fixture-gate-f61e0f7-2026-11-05/` and
`evidence/ios-automated-acceptance-f61e0f7-2026-11-05/`.

Current automated acceptance is checked by
`scripts/qa/ios-fixture-release-evidence.mjs`. It requires the completed successful
job, SDK build, every one of the eleven actual screen cases, successful disposal,
empty artifacts, exact source/workflow archives and all current build-input
hashes, including resources. Workflow jobs, permissions and concurrency must
still match. A passed label or an older seven-case index is not sufficient.

`retain-ios-fixture-gate.mjs` records an already completed job without starting
another run. `accept-ios-fixture-gate.mjs` refuses mismatched current inputs before
writing anything. On acceptance it changes only the two iPhone automated entries,
retains all previous evidence references and writes a new cumulative index. All
physical, operational, store and safety requirements remain unchanged. The gap
report and final manifest validator verify this proof instead of trusting a label.

Historical failure tests still enforce their original failures, source hashes
and lack of acceptance. Their assertions about a mutable current manifest now
check current proof rather than requiring it to remain pending forever. Historical
indexes and reports are never rewritten. The normalized d56 report is valid for
its own source only; the later chat input-readiness helper cannot inherit it.
See `evidence/ios-fixture-gate-d56cec6-2026-11-05/`.

## Earlier Checkpoints

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
Both automated entries became pending again until that changed source passed the
complete SDK-linked build and all eight fixture tests. The current inventory has
since grown to eleven; see the current contact-transfer result below and
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

A current passing result would prove compilation against the declared SDK dependencies
and eleven fixture-screen checks, not authentication, transactions, conversation
delivery, GPS safety scenarios, physical iPhone behavior or release readiness.
Failures remain failures; no automatic test retry or reduced test selection is used.

Closed-app team notifications remain a separate unimplemented iPhone path. At
`aac8de6`, the project has no FirebaseMessaging product or Apple notification
registration/receipt wiring; the server registration schema accepts Android only.
Neither the eleven fixture cases nor an SDK build can accept this missing path.
The owner is being asked to choose the display/privacy behavior before platform
integration, because background delivery is not guaranteed after full closure.
No requirement is waived and no automatic display fallback is approved. See
`evidence/verification-followup-aac-2026-11-05/` and `../contracts/team-push-notifications.md`.

Local native logic checks passed on 4 November 2026 at source `6948862`. That
Foundation-only run is not an iOS app build. The local computer has Command Line
Tools but not full Xcode, so it cannot run the complete app or iPhone simulator.

Saved emergency-contact management and verified-parent selection are now wired
and locally checked, but still need their current SDK/UI run. Conversation actions
remain incomplete. Keep all physical, operational, store and safety-audit evidence
requirements open for both platforms.

At `84c9b62`, run `41935572872` fails SDK compilation at the contact adapter's
task-isolated dictionary transfer to a `sending` parameter. No fixture UI executes;
disposal succeeds and the artifact inventory is empty. The typed-request candidate
passes controlled local payload/signature checks, not an SDK build. The 50-minute
deadline and all eleven UI cases are unchanged. See
`evidence/ios-contact-request-2026-11-05/`.

The later team-conversation candidate wires directory selection, history,
persisted drafts, stable-ID sending and visible-message reads. Its controlled
logic and separate disposable-service rechecks pass; SDK compilation and the
extended existing messages UI case remain unexecuted. All eleven cases and the
same deadline/capture policy remain required. This is not notification, complete
conversation, physical or release acceptance. See `evidence/ios-team-chat-2026-11-05/`.

The later received-rating candidate source-wires the real average/count into the
profile with a captured account generation, explicit refresh and no zero-score
fallback. Controlled checks and eight isolated backend checks pass, including
104/105-review aggregates; SDK/UI and complete rating-flow acceptance remain
unverified. Assertions are prepared inside the original profile fixture case,
not an additional case or capture. See `evidence/ios-received-ratings-2026-11-05/`.

The account-refresh race comparison in `evidence/ios-account-refresh-2026-11-04/`
reproduces late private data restoration after sign-out with the original AppState.
The candidate passes local checks for atomic snapshots, revocation, account/role
ABA transitions, response ordering and cancellation. This is not a completed
sign-out UI: its profile action, auth completion and tracking teardown remain open.
