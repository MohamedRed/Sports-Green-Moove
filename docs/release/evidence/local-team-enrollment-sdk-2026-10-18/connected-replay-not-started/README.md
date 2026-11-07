# Connected Team Replay Did Not Start

Native CI run [39173523631](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39173523631)
tested commit `7ab53908f87e3eee0423c38ead677b2ac962e32a` on 18 October 2026.
The unchanged original job log and three original artifacts are bound by
`artifact-sha256.json`. The zero-byte restore artifact is deliberately retained,
not repaired into a successful receipt.

The ordinary JUnit report contains 144 case records, including 34 skipped cases,
zero errors and zero failures. The SDK-connected team case is explicitly skipped
in this ordinary, non-emulator-backed app profile. Four separate simulated team
component cases pass; they are not connected service proof. The job console's
different progress totals do not replace the retained JUnit case inventory.

At 22:58:50 UTC, the first store-review screenshot transfer stops partway through.
The immediately following isolated replay cannot select an online emulator; the
restore command also finds zero online emulators. Suite exit statuses are ordinary
tests 0, component evidence 1 and local replay 1. The runner subsequently accepts
the emulator-console shutdown command, so this does not establish that its process
had died. It does not establish why the device transport was unavailable either.

No connected team case, full isolated replay, new team capture or successful store
restoration is proven by this run. The release manifest is unchanged. The previous
offline transfer observations are retained separately in `../previous-transfer-failure/`;
they do not turn either run into a pass. No retry, longer deadline, alternate copy,
weaker device policy or provider/plan change has been introduced.

For the approved physical-phone path, a fresh isolated loopback-profile APK built
locally from this commit (`be.sportgreenmoove.app.local`, project
`demo-sgm-local-qa`) has SHA-256
`6fc824d795aa7c737ffcf35ab294596922f97403909e680fcea8bde316eda64e`.
The subscribed App Live dashboard was reachable, but launching the signed,
notarized desktop helper through the available app control timed out.
The background helper did start despite that app-control timeout. Its documented
local console was then opened and required an access key; no connection was
configured. No new phone session, upload, tunnel, account action or flow result
is claimed from this preparation. The existing private phone procedure
remains `docs/release/browserstack-isolated-phone-test.md`.

Future component-transfer and local-replay failures now collect bounded host
observations without requiring an online device: bridge/platform-tools versions,
emulator-state counts, and signal counts from the last 64 KiB of the current
user's daemon log, if available. Raw log lines, account/device identifiers and
command output are not retained. Missing observations stay missing; these counts
do not establish a root cause or a passed test. There is no retry, daemon restart
or device-policy change. Tests exercise redaction and preservation of failures.
