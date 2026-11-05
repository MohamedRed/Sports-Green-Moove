# iPhone Club Membership: Local Checks And Retained UI Failures

Checked 5 November 2026. The previous Groups screen changed only a local set.
The candidate replaces that stub with paged club discovery, an exact displayed
club request, fresh server readback, membership details and manager review.
Managers choose a server-authorised club and confirm the exact displayed request
version before approving or rejecting it. Pending/rejected memberships no longer
count as active just because their role field exists. No client role is granted.

All production requests use immutable account-generation work leases. They check
identity before dispatch and after the actual callback. Closing, suspending,
changing roles, signing out and same-UID reauthentication cannot restore old
private lists or feedback, overlap outstanding work or release its lease early.
Writes do not optimistically change membership. Unknown/foreign receipts require
an explicit fresh read before another submission. Pagination rejects duplicate,
foreign and cyclic pages while retaining an empty scanned-page continuation.

Controlled native checks pass: eight active/status combinations, twenty-nine
malformed/foreign groups and 128 delayed success/error boundaries across eight
operations. The actual adapters pass controlled callable/Firestore signature
checks, not SDK acceptance. SwiftUI syntax parses. No new fallback is introduced.

Seven separate isolated backend/client-rule checks pass. They exercise real local
request/review callables, a concurrent single decision winner, two approvals and
one refusal, three audit records and three notifications, revoked/foreign manager
denial, stale re-request version denial, 25 history records and 26 managed clubs.
The client-rule test proves an absent direct membership read is denied, whereas a
bounded query constrained to the authenticated user's ID and club returns an
empty result safely. The candidate uses that query, without widening any rule.
Foreign and anonymous queries and direct deletion remain denied. All 110 records
and account claims captured after fixture preparation remain unchanged by reads
and denied actions. The receipt confirms client closure, local environment
destruction and closed endpoints. This is not native-to-service integration.

The first focused backend attempt used the larger UI fixture, which also adds
managed clubs, and failed the existing minimal-fixture review assertion. Its
original failure receipt and exact harness source are retained. The corrected
runner uses the same minimal seed as the original service suite; it does not
weaken the review assertions. Two separately interrupted full-suite attempts
produced no completed receipt and are not accepted. Their observed partial steps
are retained independently; their processes were absent, endpoints closed and
only their owned temporary runtimes were disposed.

The actual earlier 9f7f0ee SDK build passes, but its complete UI gate fails:
eleven cases execute, nine pass and two fail (three assertion failures). The
parent's discard confirmation lacks the keep-editing action; the team thread's
container identifier overrides the Back and Refresh button identifiers. Selected
failure hierarchy lines, all case outcomes, terminal metadata, successful
simulator disposal and empty artifact inventory are retained. The candidate uses
an explicit two-action alert with a captured pending action and removes the
thread container identifier, preserving individual button IDs. Original parent
and team test predicates/timeouts remain unchanged. These changes are not yet
accepted as repaired on iPhone. Prior evidence stays immutable.

The existing secondary fixture case adds prepared request/detail/manager-decision
assertions with DEBUG-only synthetic accounts, not real roles. All eleven cases,
the approved 50-minute deadline, standard public runner and optional three-image
under-2-MB/one-day capture policy remain unchanged. No new capture or phone run
was performed. Native layout/accessibility, current SDK/UI, real Phone handoff,
physical tracking, safety and operational acceptance remain outstanding. Booking
and ride chat plus profile city editing also remain unfinished. Both current
iPhone automated manifest entries stay pending. No infrastructure change needs
Terraform; no production writes, real payments or provider requests occurred.

The public portal adds a short local-only membership note and the actual
nine-of-eleven earlier UI result, superseding the older pre-screen stop. Historical flows,
statuses, dates, media, tours, blockers and previous updates remain unchanged.
`source-sha256.json` freezes the exact candidate inputs and relevant old sources;
`summary.json` records the distinct evidence layers and record checksums.
