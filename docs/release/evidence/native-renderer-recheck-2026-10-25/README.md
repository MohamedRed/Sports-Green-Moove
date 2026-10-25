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
