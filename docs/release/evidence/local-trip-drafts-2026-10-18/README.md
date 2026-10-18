# Private Trip Drafts - 18 October 2026

The owner approved retaining unfinished private trip edits on this date.
Implementation/persistence contract: [private-trip-drafts](../../../contracts/private-trip-drafts.md).

## Unit And Component Evidence

`unit/` retains the 11 new successful persistence cases and 19 existing/updated
trip state cases. All 245 Android JVM cases passed locally; instrumentation
compilation also passed. These are not native process-death execution receipts.

`component-native/` retains nine originals from source
`57512fa983c63f75a8500728f39e33078e44c855`, Native CI run 39085527859.
Artifact 12120754364 is 14,166,433 bytes.
The ordinary report contains 114 cases, 88 passed, 26 conditional local-only skips,
no failures/errors. All three `TripDraftPersistenceFlowTest` cases actually ran:

- Invalid raw price and an unresolved address survive closing/reopening the
  large-text editor; submission remains disabled and no proposal is sent.
- A new real preference-store instance retrieves the same private record;
  other account/trip keys do not retrieve it and unresolved coordinates stay null.
- The codec rejects corrupt, foreign, malformed coordinate/flag and request data.

The 1080×2140 Compose capture and full-window original were retained. The Compose
image has been visually reviewed; it is a simulated component screen with an
in-memory backend, not a real ride, provider result or full app process restart.
It has not been added to the partner gallery yet.

That broader job **failed**, despite passing ordinary/components: the isolated
network test timed out in its 30-second preparation probe, before the offline
send. Its failed transcript, partial typed result and diagnostics are retained.
There is no complete `results.json` for that run. No retry or successful offline
outcome is inferred from those artifacts.

## Earlier Attempt Also Remains Failed

`force-stop-attempt/` retains five originals from source
`155bbafa455051babfd7de05a1efc9d70e2fc575`, run 39085238967.
Artifact 12121092548 is 13,411,161 bytes.
Its 32 local groups completed successfully at 2026-10-18T01:30:39.463Z, run ID
`40f6e595214c75390a4ffca1133791e1`. Its three draft component cases passed, but
the ordinary report contains a separate `largeTextParentSeesBothVersionsAndAcceptsWithoutApplying`
PixelCopy failure. Independently, the store's stopped flag was cleared at cleanup,
so the force-stop-only store pause was not accepted. The empty restore file is
retained as empty, not a restoration-success receipt.

Both directories include SHA-256 manifests of their exact original bytes. Their
separate failures are not attributed to one shared cause. A newer successful
run must not rewrite or hide them.

## Completed Native Restart Stage

`restart-native/` retains 16 exact originals from source
`f4ada948c1154eff3b89ac1c0b58f4a4451ad36f`, run 39085977464.
Artifact 12121377431 is 13,878,726 bytes. The draft stage completed at
2026-10-18T01:40:40.012Z, local run `57ce0d4a32a18cb523c1e4ee7fe98ab0`.
Both actual instrumentation cases passed around a guarded force-stop, with
different process IDs 11481 and 11614 and the same private draft hash.

The driver returns without another login, finds the same incomplete price and
both unresolved addresses, and cannot submit them. The second trip's editor stays
empty. Complete trip, booking and notification hashes remain unchanged before
typing, before the process boundary and after recovery; no proposal, quote,
balance or ride exists for either fixture. Two actual images and the successful
same-run copy receipt were retained. The restored image was visually reviewed
and allowlisted for publication without editing its app content.

This is one completed stage, **not a successful full 33-group run**. That job
failed separately in PixelCopy at
`agreementStillRequiresRouteAndApplicationAndDoesNotClaimSettlement`, and again
at the network-preparation probe before an offline send. The ordinary report
records 116 cases, 87 passed, 28 conditional skips and one failure. The final
suite status records ordinary=1 and localReplay=1; there is no complete
`results.json`. Retained failures are not turned green by the passing draft stage.

## Still Pending

Other draft field variants and physical phones need native verification. The
strengthened store-background policy also needs
its own actual execution/cleanup evidence; it is not proven by older force-stop
receipts. See the [test-phone contract](../../../contracts/disposable-store-pause.md).

No physical-phone, iOS, live route, application, payment/refund, emergency-action
or final release acceptance is claimed. The active overall user-flow goal remains
incomplete. The gallery uses the completed history/time-label run plus the
individually verified draft restart stage; it does not claim the latest full run passed.
