# Conversation Directory Rollout

This change is verified against isolated demo data only. It does not deploy any
production function, rule, index or historical-data mutation.

## Contract

`listChatConversations` returns 20 private summaries plus an optional cursor.
`listChatBookingOptions` returns 20 reservations for the authenticated parent or
driver, including reservations without messages. Both use immutable timestamp /
document-ID cursor values bound to the authenticated user and list kind. The
cursor is not an authorization token: source membership is checked again.
Changing a boundary conversation's last activity cannot shift an issued cursor.
Trip context accepts the actual ISO departure date written by publication and
historical Firestore timestamps. Missing/invalid dates fail, never default to now.

`chatInboxes/{sha256(JSON.stringify([userId, sourceType, sourceId]))}` is server
owned. Clients may read only their own entries, never write them. Each entry
stores schemaVersion, userId, sourceType, sourceId, revision, unreadCount,
lastMessageId, lastMessageAt, lastMessageBody and lastSenderUserId. Read counts
cover the whole history, not the latest message page. Message creation,
recipient notifications and all participant summaries commit atomically with
server timestamps. Read acknowledgements decrement only newly read incoming
messages and preserve the original activity position. Counter underflow fails
atomically. A repeated keyed send or repeated read does not increment counters.

Android uses the new directory and a reservation picker. Selecting an empty
reservation does not create a message or summary. Existing ride-session threads
remain accessible; starting a new group thread is not added by this change.
The legacy `getInbox` response remains compatible and bounded; it is no longer
the Android conversation-discovery source. iOS has not been migrated.

## Existing History

There is no automatic migration, synthetic first message or legacy-query
fallback. New sends/read acknowledgements refuse an unindexed existing history.
Prepare every existing participant/source entry before releasing the client.
Current source members see only historical messages originally addressed to them;
no shared last-message summary is copied across changing recipient sets.

Build the functions first, then preview exactly one user and source with ADC
credentials that are kept outside the repository. The tool initializes only
Firestore; no Realtime Database URL is required:

```sh
npm run build --workspace functions
npm run prepare:chat-inbox -- --project sports-green-moove-staging \
  --user USER_ID --booking BOOKING_ID
```

The command defaults to read-only dry-run. Use `--ride RIDE_SESSION_ID` instead
of `--booking` for an existing ride conversation. It streams 100 rows at a time
without a history cap. Malformed history, changed row count/latest position, or
an existing index that disagrees with history fails rather than being replaced.
This is creation/verification tooling, not a corruption-repair command.

## Deployment Order

1. Arrange a maintenance window and quiesce all old/new message creation,
   read-marker updates, source membership changes and administrative edits.
   Stop old in-flight revisions too. The confirmation flag asserts this operator
   prerequisite; the script cannot establish or prove a write lock itself.
2. Deploy the checked-in Firestore rules and indexes; wait for all indexes to be
   ready. These declarative files are the infrastructure source of truth.
3. Dry-run each explicit participant/source pair. Review counts and errors.
4. Apply only after approval and verified quiescence, with both
   `--apply --confirm-project sports-green-moove-staging --confirm-quiescent`.
   Re-run to require `already-indexed` for every populated pair. Empty sources
   deliberately create no summary. There is no wildcard/bulk project scan.
5. Deploy the updated message/read/directory callables, then release the Android
   client. Resume writes only once every existing pair is prepared. Verify an
   actual first exchange, old conversation discovery and both read counts.
6. If interrupted, keep maintenance in place and re-verify every pair before
   resuming. Do not revert only the server writer after enabling indexed clients:
   old writers would leave summaries stale. Coordinate any rollback as a whole.

No production preparation or deployment has been performed by the local tests.
No Terraform resource is created by this change; Firebase rules/index JSON is
updated directly in its existing managed deployment path.
