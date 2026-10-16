# Local Conversation Recovery Verification

## Interrupted First Replay

Native CI run 38859567149 at source `208d34580d3e97d77368952883c1a80571d34db1`
failed on 2026-10-16 in the existing `LocalChatFlowTest`, before the directory,
reservation, membership and new network cases. No completed `results.json` was
produced. No message-recovery or account-isolation claim is accepted from it.

The instrumentation report records `Detected multithreaded access to
SnapshotStateObserver`, previous thread 75 and current thread main/2, while
recalculating semantics. The separate Android crash buffer was empty. This is
not proof of a production process crash, nor proof that the earlier SlotWriter
failure has the same cause. Earlier passing evidence remains historical evidence.

The source resolves Compose UI/test 1.10.6, despite the older direct BOM request.
The default rule uses an UnconfinedTestDispatcher, which can execute resumed
composition effects inline. The next replay explicitly selects the already
supported StandardTestDispatcher for both SDK-backed conversation cases. This
queues effects and preserves every existing assertion, with no retry, skipped
case, increased deadline, production change or feature-disabling flag.

This is a scheduling investigation, not a confirmed root-cause closure. Android's
[test scheduling guidance](https://developer.android.com/develop/ui/compose/testing/migrate-v2)
explains the dispatcher distinction; the checked 1.10.6 source supports an explicit
effect-context dispatcher without upgrading the app's framework dependencies.

## Scope

The new case requires OS Wi-Fi and mobile data to be disabled on an explicitly
disposable demo emulator, zero active internet networks and an unreachable local
Functions socket. Only then may the unconfirmed send and retained draft be
checked. Original settings must be restored before explicit retry and account
switching. Independent stored-message and read-notification checks are mandatory.

Disconnection after server commit, process restart, expired credentials, physical
phones, provider push and location tracking remain outside this case. No release
manifest requirement or production deployment is accepted by these local tests.
