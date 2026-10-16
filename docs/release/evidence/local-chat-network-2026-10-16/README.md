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

## Second Replay And Confirmed Picker Defect

Run 38861250818 at `bc4d299ca2a80a415a553f6349a7062452219d22`
completed the 16 earlier isolated cases, including both conversation cases. The
new case then timed out in the new-message reservation picker, before any network
change. Its receipt has `completed: false` and an empty `network` array. The old
phase label `login` also included picker setup; the stack identifies line 59's
trip-title wait, not an authentication failure. No complete result was written.

The reviewed original `booking-picker-failed.png` shows a real error and retry
button, not an empty reservation list. The callable had returned a page containing
the reservation refused in the earlier decision case. The backend's canonical
BookingStatus uses `declined`, but the native conversation enum used `rejected`.
Mapping one refused reservation therefore threw NoSuchElementException and
discarded the whole page. Membership refusal legitimately uses `rejected`; that
separate contract is unchanged.

The new mixed-page regression reproduced this before the fix: three mapper tests,
one failure, retained in `booking-status-before.xml`. The scoped fix replaces the
unused conversation Rejected state with canonical Declined and explicitly rejects
unknown status values. It neither drops refused bookings nor invents a default.
The replay fixture now independently requires both declined and cancelled records
in the actual picker response before app execution.

After the fix the same three mapper tests pass in `booking-status-after.xml`.
The full native unit task and instrumentation APK build also pass locally. These
checks do not yet establish an app-level picker or connection-recovery pass.

## Third Replay: Picker Recovered, Disconnection Not Proven

Run 38863162034 at `6cdf92f50e705eddf428d18efb2fa8118608ebe8` again
completed the 16 earlier cases. The new case loaded the actual picker response
including refused/cancelled reservations, selected the new trip and opened its
empty authorized conversation. The reviewed original `booking-picker-recovered.png`
shows accepted, refused and cancelled reservations together; the separately
retained `booking-conversation-opened.png` shows only the empty conversation.
Neither image proves a message exchange.

The case then failed at its unchanged 30-second disconnection check. The receipt
contains only the connected baseline, not a proven offline state. Recovery,
retry and cross-account draft checks were not reached. No completed result was
written. The prior global-setting check did not record the state at failure,
so this report does not infer that Ethernet or another transport remained active.

The next version reads Wi-Fi and mobile-data state through WifiManager and
[TelephonyManager.isDataEnabled](https://developer.android.com/reference/android/telephony/TelephonyManager#isDataEnabled()),
which reflects the default data subscription, rather than the legacy global
mobile_data key. It still requires no active internet network and an unreachable
backend. It persists original actual settings before mutation, binds them to this
run's identity, and records failed-disconnection transport/state diagnostics before
cleanup. Host cleanup reads that same validated baseline, not a guessed default.

This run's separate configuration job also failed because its new TypeScript
contract parser had no installed dependencies. The workflow now installs the locked
dependencies before those checks. No case is omitted to obtain a green workflow.

## Completed Fourth Replay

Native CI [38865353101](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38865353101)
passed all enabled jobs at `dc99ecb5c004c565d7b7587b0fe5c61ff9be46e5`.
Its immutable `results.json` records run `1914c72fdb83f3cec9c59db6db6c21d8`,
completed at 2026-10-16T07:23:19.423Z: 17 instrumentation cases and 19 coverage
groups. The four search component cases still use their explicit fake gateway;
this does not turn every coverage group into a live-provider test.

`local-chat-network-ui.json` and the original/normalized passing instrumentation
reports prove the new case completed. Its connected baseline had Wi-Fi and mobile
data enabled and two internet networks. Offline: both disabled, no active network,
zero internet networks and the real local Functions endpoint unreachable. After
restoring the same settings, the endpoint was reachable over an active cellular
network. This proves settings restoration, not identical active transport sets or
Wi-Fi association at that exact instant. No timeout or offline assertion was relaxed.

The real app reported an unconfirmed send with its draft and retry action intact.
Explicit retry succeeded, the driver replied, and the parent saw the reply. A
private synthetic draft did not cross accounts or reappear on return. Independent
database verification required exactly two intended messages, zero duplicates,
two correctly addressed read notifications and zero unread counts for both actors.
The picker response retained approved, cancelled, completed and declined bookings.

The refreshed `services.json` separately records all 16 isolated service groups
passing at 2026-10-16T07:27:30.297Z, run `ad09904191c4a173c00d8fa0b8cf9e2d`.
It does not claim payment-provider or physical-device success.

The portal publishes only the reviewed, correctly framed unconfirmed-send capture
from the completed run and the earlier recovered-picker capture, with its precise
provenance above. Other completed-run captures caught keyboard/window movement
and are not allowlisted; their originals remain in the CI artifact. They are not
edited to hide that framing issue. Follow-on harness changes explicitly wait for
keyboard opening, closing and restored composer bounds; those changes belong to
the next current-head replay, not this saved run. Full phone keyboard/layout
coverage and the older SlotWriter failure remain open.

The application changes are not deployed to production. The partner website is a
separate private publication. This evidence does not accept any physical tracking,
real safety-audit, payment or push requirement in the release manifest.

## Recovery Scope

The new case requires OS Wi-Fi and mobile data to be disabled on an explicitly
disposable demo emulator, zero active internet networks and an unreachable local
Functions socket. Only then may the unconfirmed send and retained draft be
checked. Original settings must be restored before explicit retry and account
switching. Independent stored-message and read-notification checks are mandatory.

Disconnection after server commit, process restart, expired credentials, physical
phones, provider push and location tracking remain outside this case. No release
manifest requirement or production deployment is accepted by these local tests.
