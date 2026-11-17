# Team Alert Services, 1 November 2026

The product owner selected both in-app alerts and phone notifications while the
app is closed. This report accepts only the isolated server foundation, not the
complete requested flow.

Eleven actual callable scenarios pass against disposable local services. Sending
one message creates one generic alert per eligible recipient and one pending
phone-delivery envelope in the same transaction. Concurrent retries and conflicting
content create no duplicates. The alert contains no private message or team name.
Only current approved adult members and individually verified parents qualify;
child accounts/profiles/links, disabled accounts, an unverified parent, the sender
and a club manager without team approval are excluded.

Inbox reads and read acknowledgements recheck current team identity, live approval
and the current admission history boundary. Revocation, renewed authority and team
recreation cannot recover earlier alerts. Two qualifying children generate one
parent alert; removing one preserves only history admitted by the remaining link,
and removing the last hides the alerts. Reading an alert does not acknowledge a
team message. Direct client access to team alerts and pending envelopes is denied.
An audience exceeding the explicit 496-candidate bound fails before any write.

All original top-level records and account claims/disabled states are preserved,
except three precisely owned lifecycle records whose final transitions are
asserted. Child data remains baseline-protected, including restored guardian IDs.
The admin clients close, the disposable runtime is removed and all four service
ports are independently verified closed. No real account, provider, maps, payment
or production request is made. Source hashes bind the retained service run to
content-addressed snapshots; they do not attest an installed APK or deployed app.

## Earlier Harness Failures

The first trial completed its behavioural checks but failed the isolation assertion
because it treated its intentionally changed parent verification as unrelated
baseline data. The corrected nine-case trial passed. The subsequent two-child
extension initially expected pre-admission history to survive removal of the older
grant. The service correctly hid that earlier alert; the assertion now checks a
message sent after both approvals and requires the older alert to stay hidden.
Both original assertion excerpts and full-log hashes are retained. Their earlier
dirty source snapshots were not captured; no source-bound regression is claimed.

The ordinary notification regression suite then caught an unrelated realtime
database initialization introduced through the new access-helper import chain.
The unchanged Firestore-only read suite could not load its callable. The fix
imports the narrow Firestore module in the access/enrollment authority helpers,
not a fabricated database URL or a test-only mock. Its original negative
transcript is retained as `notification-read-import-failure.txt`; its earlier dirty
snapshot was not captured. The earlier successful 13-source alert report is kept
as `previous-services-<sha256>.json`; the latest result binds all 14 source files.

## Still Unfinished

There is no push dispatcher, token registration/revocation, native receiver,
background/closed-app delivery or phone proof in this change. A pending envelope
is not an attempted or successful delivery. The Android inbox currently loads
these alerts through its existing callable refresh; its legacy live listener does
not observe the new server-only collection. Instant foreground arrival, notification
tap navigation, stale on-screen alert removal, simultaneous phones and iOS remain
to implement and verify. No release manifest requirement is accepted here.

The new collection index and explicit deny rules are versioned alongside the
application; no hosted resource, secret, infrastructure or audience is changed.
Web Integration Smoke executes the dedicated alert trial separately while
preserving the original conversation/history and ordinary notification suites.
