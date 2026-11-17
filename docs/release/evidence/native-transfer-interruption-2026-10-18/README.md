# Native Suite Passed; Primary Evidence Transfer Failed

Run `39139059838`, source `fc74d93ac734ce7bf73548f03aeee6abc4adbfbb`,
failed overall. The original `general-ui.xml` contains 124 cases: 93 passed,
31 intentionally skipped, zero failures and zero errors. SHA-256:
`6360cd164a5104e08138994717603b0d299efbd2387ff3516ee261f8e60eaad9`.
The earlier PixelCopy capture failure was not reproduced, but is not fixed or
explained by this one passing ordinary suite.

The separate isolated replay `e9602ca81b23d6e4697306ba329803ae` stopped during
the primary `trip-change-parent-confirmation` evidence copy. Its original
receipt records adb 37.0.1, exit=1, no signal or host-process error, and only
`pull: building file list...` after connection setup. No successful copy or
file count is reported. The ordinary failure buffer is not involved in this
attempt: the ordinary suite already passed.

The scoped `LocalTripChangeFlowTest` device transcript says one test passed and
`local-trip-change-ui.json` records its device assertions. Neither is a completed
host-verified trip-change stage or complete replay. No `results.json` or
`trip-change-ui-stage.json` was produced. The independently named cleanup copy
subsequently collected 52 files successfully; it cannot overwrite or repair the
failed primary receipt. Store restoration verified successfully.
`native-suite-status.json` retains ordinary=0, collection=0, replay=1.

## Follow-Up Diagnostics

The current AOSP file-sync client's `FinishLsImpl` can return false for several
read/framing/filename conditions without explaining which condition occurred.
This is a diagnostic lead, not proof that a particular AOSP revision matches the
installed binary or that its protocol parser caused this failure. Source:
[AOSP file-sync client](https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/client/file_sync_client.cpp).

The added failure-only probes separately collect directory metadata, shell
listing counts and file-sync listing counts, plus filtered storage/adbd logs.
File names and contents are not persisted by the listing probes; logs redact
the isolated fixture password and common credential formats. Every command is
read-only, individually bounded, and restricted to the disposable test target.
No additional transfer, reconnect, device reset, permission change, retry,
deadline extension or fallback has been added. The original transfer failure
remains the outcome even if every diagnostic query succeeds.

Those probes have local subprocess/parser tests, but were not present in this
run and have no device result yet. The underlying copy failure and earlier
capture/focus/process interruptions still need root-cause evidence and fixes.
No physical-device scenario, provider outcome, team/emergency user flow or
release-manifest requirement is accepted by this report. All older evidence
remains retained with its original dates and limitations.
