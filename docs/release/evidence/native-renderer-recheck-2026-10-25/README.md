# Native Rendering Recheck, 25 October 2026

This record preserves two independent negative outcomes. Neither is release
acceptance, a physical-phone run, or a completed root-cause repair. No new media
is published, and no production service or app is deployed.

## Full Matrix

[Run 40224919474](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/40224919474)
is completed with failure at source commit
`25359420c8ef067504cb4b74fe0715e35b522481`. Its full job uses the supported
`-gpu software` option. All ten independent safety jobs pass at that commit.

The ordinary transcript contains 220 discovered cases: 165 passed, 54 skipped,
and one failed. `TripChangeFlowTest.largeTextParentSeesBothVersionsAndAcceptsWithoutApplying`
fails at its initial large-text review capture, with `Failed waiting for PixelCopy!`.
The preceding semantics and bounds checks do not prove that the image captured
successfully or that the subsequent acceptance action executed. The original
transcript and parsed inventory are retained byte-for-byte.

The later local replay finishes all 37 groups / 40 native cases. Its primary
trip-change, trip-consent-recovery and notification-restart copies succeed.
`native-suite-status.json` remains `{ordinaryTests:1, componentEvidence:0,
localReplay:0}`. Component collection after the failed ordinary suite is partial,
not acceptance of the complete component-image inventory. Device policy and app
restoration are verified. The host observer ends in `zombie` state and explicitly
does not claim a reaped process exit.

The deprecated graphics configuration is corrected, but this experiment does
**not** fix the repeated PixelCopy failure. No retry, timeout extension, substitute
screenshot, skipped assertion, or fallback is added.

## Independent Team-Chat Job

[Job 121269009772](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/40226545552/job/121269009772)
is completed with failure in the later run for
`66a9044be99c4912b103c664cb95f908c436ad6d`. The overall later run was still active
when this record was retained; this is not its terminal full-run result.

Its screen instrumentation reports `OK (1 test)`. Primary evidence copying then
fails with status 1, not a timeout. All three immediate file/listing diagnostics
report `device offline`. The guest log records host-20's connection ending with
`write failed` at 19:42:23.058, followed by a new authenticated host-21 connection
at 19:42:23.659. A stable host daemon PID and zero bounded host-log counters do
not disprove this guest-side transport loss. No app/SDK/root-cause conclusion or
whole-flow acceptance follows from the passing screen assertions. Cleanup
restoration and original failure records remain distinct.

The full downloaded archives remain outside the repository. This bundle retains
the selected original records, authoritative run/job metadata, provider artifact
IDs/digests, and SHA-256 hashes. It does not replace older records or captures.

## Later Terminal Result and Local Diagnostics

`later-run-terminal.json` subsequently records run 40226545552 as completed:
the main Android UI job succeeds, while the team-conversation job and aggregate
safety gate fail. Thus the screenshot failure is intermittent, not a confirmed
fixed root cause. The earlier snapshot and its failed primary-copy receipt are
unchanged. This later main-job success does not accept the whole run.

The local component diagnostic has three distinct attempts, none accepted.
Attempt 1 stops before setup because the full-matrix mode is Linux-CI-only;
that restriction is not bypassed. Attempt 2 uses a newly explicit manual mode
with its two hash-pinned ordinary APKs and continuous installation guard. Its
instrumentation exits with `shortMsg=Process crashed` before any screen
assertion. Original cleanup is negative because the new two-package set was not
yet in the removal allowlist. Policy, launcher, background settings and temporary
administrator restoration succeed. The exact missing package set is then added
to the cleanup allowlist and tested through the real cleanup function.

Attempt 3 runs on another fresh Android 35 ARM64 emulator, with 2560 MiB memory
instead of the second attempt's 1536 MiB. Instrumentation again reports a process
crash before assertions. Its Java-only crash-buffer query returns no entries;
this does not establish a crash cause or absence of native crash records. The
executed manual runner source is archived before improving the next diagnostic
to include native crash tags. That improvement is unit-tested, not claimed to
have executed on this device. The APK source itself is unchanged from 94aa7dd.

Attempt 3 independently verifies full restoration, including both package
removals and removal of the temporary administrator. All three owned virtual
devices are stopped and deleted; disposal is recorded separately and does not
overwrite attempt 2's failed restoration receipt. The raw startup failures,
installed hashes, policy receipts, executed source and disposal record remain
internal. No new screenshots, successful screen test, physical flow, or release
scenario is accepted. The failed full CI tests and the one-test local diagnostic
remain separate scopes; no retry, alternate screenshot or timeout increase is
added to the ordinary CI runner.

## Fourth Startup Attempt and Next Completed CI Run

The fourth fresh local emulator uses the same single-test runner from de8b4d2,
including its full crash-buffer query. That buffer is empty. The separate,
package-scoped Activity Manager exit record reports reason 6 (ANR), with
`failed to complete startup`, before any test assertion. This is startup ANR
evidence, not a Java/native exception stack, a screenshot failure, or a confirmed
root cause. The executed runner and host controller are archived with the records.

Restoration is fully verified and the controller exits. A subsequent read-only
boot of that already-restored owned device queries its retained ANR DropBox
entry, without installing or executing the app. The entry is compressed text of
zero bytes and prints `java.io.EOFException`; it supplies no usable stack. The
read-only controller also exits and the owned virtual device is deleted. This
does not repair or override any prior failure. No fifth phone attempt, test
retry, timeout increase, or new user-flow completion follows from this record.
The manual runner now retains its own package-scoped exit record on future
startup failures; that additional collector is unit-tested, not claimed to have
run as part of the archived fourth runner.

`current-run-terminal.json` records run 40228374183 at source 94aa7dd as completed
with failure. Unlike the prior run's main-job success, this main job fails at
component-image collection: its ordinary inventory completes 220 cases with
166 passed, 54 skipped and zero failures; the later replay completes 37 groups /
40 native cases. Suite status remains `{ordinaryTests:0, componentEvidence:1,
localReplay:0}`. All three numbers matter: passing assertions and a completed
replay do not accept the failed collection or full gate. Original result records,
cleanup verification and the provider artifact ID/digest remain checksummed.
Earlier run snapshots and public media remain unchanged.
