# iPhone fixture result at 84aa134

Checked 4 November 2026. Source: `84aa1349933844f78fd9180d33583301f0c35e1f`.
Run [41876307906](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41876307906),
job `126746062980`, is terminal **failure**, not a complete UI-gate pass.

The SDK-linked build succeeds. All seven fixture cases execute: six pass, one
fails, none skip. The extended authentication case renders the form, submits
synthetic credentials, reaches home, opens the profile, checks its synthetic name
and verifies parent/driver access without child/club-manager access. This accepts
that rendered fixture only, not real provider authentication or role provisioning.

The first consent case fails at `XCUIApplication.launch`, before its consent
assertions: "Timed out while launching application via Xcode." Its underlying
cause remains unknown. The second consent case and all five main cases pass.
Simulator disposal succeeds. The original 35-minute job budget is unchanged.

`fixture-log.txt` is the unchanged test-step member of the verified original ZIP.
The private ZIP passes `unzip -t`; archive, full job log and selected member hashes
are retained in `summary.json`. `source-sha256.json` hashes the tested commit's
source, not later local changes. Only synthetic fixture identity appears in the
selected log. No native image/video artifact was retained or published.

The later candidate separately boots and waits for the newly created simulator
before compilation, avoids explicit production provider initialization in the
DEBUG fixture path, and emits four static startup phase markers. Failure-only
diagnostics query that dedicated subsystem. These are preparation/isolation and
observability changes, **not proof of the launch failure's cause or repair**.
There is no test retry, app warm-up, skipped case or enlarged deadline.

The local location-stop candidate, real account authentication, physical GPS,
complete sign-out, operational delivery and release acceptance remain unverified
by this run. Both Android and iPhone remain required. Existing release-manifest
items stay pending for the current candidate.
