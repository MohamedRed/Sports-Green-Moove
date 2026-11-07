# iPhone Verified-Parent Contact Selection

The 84c9b62 source had the private contact editor and child read-only route, but no
parent UI for choosing a child's contact. This candidate adds that route using
`listMyGuardianVerifications`, not declared child membership or client role grants.
Only verified records can be selected; redacted identities remain disabled.
Every contact read/write still independently checks current authority on the
server. A historical list entry never grants permission to a contact.

The list is paged twenty records at a time, including when the first page has no
verified relationship. Missing/invalid cursors, repeated cursor cycles, duplicate
IDs/targets, foreign parents and malformed records clear the actionable list.
Selection is synchronous and disabled during reads. Old account generations,
role changes, backgrounding, disposal and cancellation cannot restore old names,
choices or cursors; account leases drain only when their actual work settles.

Choosing another target confirms discarding an unfinished edit. The route then
creates a new contact state bound to the exact child/club, without carrying a
previous child's values into the personal contact. The displayed child creation
identity is sent on saves/removals. The manager role cannot implicitly enter the
parent editor; adult personal-contact capability now matches the server roles.
No migration, guessed number, alternative provider or automatic request retry.

Actual controlled Swift checks pass: fourteen malformed page groups, five cursor
syntax rejections, continuation beyond twenty records, five failed-pagination
groups, four nonparent-role denials, twenty-four delayed list boundaries, and
parent save/removal/lifecycle/authority checks. The complete existing native logic
plan, actual callable adapter signature check and controlled phone boundary pass.
Unchanged original result logs and content-addressed source inputs are retained.

One additive UI case is prepared for dirty-edit confirmation, second-page verified
selection, child save, personal-contact isolation, reopening and child removal.
It neither opens Phone nor captures images. All ten prior cases remain required;
the complete fixture inventory is eleven. The new SDK-linked build, visual/native
UI, current manager approval journey, real Phone handoff, physical tracking and
release are not accepted by these local checks. Backend/Android protocols and
production deployment are unchanged.

The separate 84c9b62 focused chat job fails before a network cut: preparation's
30-second condition is unmet at `LocalChatNetworkFlowTest.kt:83`. Its original
archive, sanitized projection, command status and independent device/host cleanup
are retained without promoting flow success or inferring the underlying cause.
The full run was still active at that focused-job observation. Its main job
subsequently fails the primary `trip-change-inputs` file transfer after all 354
ordinary cases finish (299 passed, 55 skipped, zero failed) and component evidence
succeeds. All three new pre-close observer regressions and the eight-check parent
replay actually pass. This accepts only those source-bound checks, not the full
native gate, a repaired capture/root-loss cause, physical behavior or release.
The complete original ordinary/parent/status/disposal records and a sanitized
transfer projection are retained separately from the failed chat preparation.
Keep the older passing evidence and all existing public media,
flow statuses, dates, tours, blockers and earlier updates unchanged. Publish one
brief local parent-contact note, no new media or infrastructure diagnostic news.
