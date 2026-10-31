# Local Session State Regression Evidence

Date: 2026-10-15. This is JVM controller/state verification with synthetic
gateways, not a phone or provider run. The original Gradle JUnit XML files are
retained unchanged and contain no credentials.

`app-data-baseline-failed.xml` records three failures against the previous
`AppDataState`: a delayed response repopulated data after logout, an older
response replaced the next account's refresh, and a later read failure left a
partially published screen state. No real account/data exposure was exercised.

`app-data-passed.xml` records five passing cases after the correction. Refreshes
use a generation invalidated by logout or a newer refresh. Every awaited result
is checked before proceeding, and all loaded fields publish in one Compose
snapshot. An obsolete response/error cannot affect the next session. A genuine
current-request failure is still reported; external cancellation still cancels.
Atomic UI publication is not a database-wide read-time transaction.

Verified cases:

1. Logout while a refresh is waiting leaves trips and children empty.
2. A delayed old response cannot overwrite the new account's loaded trips.
3. A failed current refresh does not publish half of a new data snapshot.
4. A delayed error from an invalidated account cannot reach the new session.
5. External coroutine cancellation cannot publish a result.

The full Android unit suite and instrumentation APK compilation also pass
locally. No production data, cloud resources, permissions or billing changed.

## Remaining Scope

This fixes the app-data refresh race, not the unexplained lifecycle crash from
[the directory UI attempts](../local-chat-directory-2026-10-15/ui-attempts.md).
The separate search controller's saved places/pending actions and other
authenticated action callbacks still need account-boundary verification.
These unit results do not accept the new directory UI run, physical tracking,
push delivery, payments or any final release-manifest requirement.
