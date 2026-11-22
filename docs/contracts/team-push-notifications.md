# Team Phone Notifications

The owner requires both in-app alerts and notifications with the app closed.
The in-app arrival/read/retry/withdrawal flow has physical Android evidence.
Closed-app delivery is not yet implemented or accepted by that evidence.

## Device Registration

`registerTeamPushDevice` is the server-side registration boundary. Authentication
selects the account; a client cannot supply another recipient ID. An enabled adult
account is required to activate registration. Child claims, child profiles and
linked child logins are excluded. Registration alone does not establish current
team admission, guardian approval or permission to receive a particular alert.
The common team guard checks current server account claims and disabled state,
not only the earlier login's claims. It also protects directory, history, send
and alert-read operations. Current-account records are reused only within one
transaction attempt; a new attempt/request must read fresh authority. Batch fanout
reuses its fresh bulk account lookup rather than issuing one lookup per recipient.

Each Android installation has a UUID and a locally generated 256-bit private
proof. The server stores only a namespaced hash of that proof. Device IDs and
token-index IDs are also namespaced hashes. Tokens live only in server-owned
documents; all client reads, lists and writes are forbidden, including admins.
Responses contain only the authenticated account, revision, active state and
whether an exact request was reused. No token or proof is returned or logged.

The client must persist and serialize a strictly increasing revision across token
updates, account switches and removal. Exact retries reuse one revision; different
content at the same revision and older requests are rejected. A newer account can
transfer the same installation only with its private proof. The previous account
cannot unregister the new owner. Removal uses an explicit null token and preserves
a revision tombstone, so delayed registration cannot reactivate the old binding.
It removes only that installation, not the account's other devices.

Token rotation atomically removes the old reverse index. A token cannot be copied
to another installation. Conflicting or malformed reverse-index/registration
metadata fails closed even on identical replay. Twenty active installations per
account bound fanout work; registration beyond the limit is rejected without
creating an extra binding. The query index is declared in `firestore.indexes.json`.

## Native Registration Journal

The Android journal and callable gateway have 27 JVM tests and a compiled
private-storage instrumented test. The lifecycle coordinator adds 21 cases and
the SDK-task queue adds three. This is local model/build evidence, not actual
provider token registration or closed-app delivery proof.

The journal stores an installation UUID and cryptographic proof in private
no-backup storage. Synchronized atomic writes allocate a durable revision before
asynchronous token retrieval. Exact pending requests survive reconstruction;
only a matching authenticated receipt clears them. A duplicate callback cannot
alter a persisted revision's payload. Confirmed state keeps only the token hash.
Account epochs reject stale callbacks even after returning to the same account.

Changing accounts or removing registration clears local confirmation and sets a
provider-token-deletion barrier. Only actual SDK success may clear that barrier;
the lifecycle controller still needs to perform this operation. A server removal
can remain unconfirmed after offline logout and cannot be replayed as a different
user. Neither local confirmation nor a deleted token proves remote delivery or
message authority. Corrupt private state fails without reinitializing identity.

The file journal assumes Android's default single application process. It does
not implement cross-process locking. All sensitive values remain absent from
diagnostic strings. The response boundary checks the Firebase current UID before
and after its call and accepts only the exact receipt schema.

`SgmApplication`, the Auth ID-token listener, foreground resume and new-token
service now invoke the production coordinator. Local emulator builds skip that
runtime completely and disable the service. Auto-init and notification delegation
start disabled. Only a permitted adult registration enables auto-init. Permission
checks include the app setting and team channel; stale callback tokens themselves
are not trusted. The server still checks current account and admission authority.

Each worker attempt is bounded to 20 seconds, with no automatic retry loop.
Subsequent real lifecycle events can retry the durable request. The token queue
keeps an uncancelled SDK task across a cancelled await and waits for its terminal
effects before another SDK token operation begins. Errors disable auto-init.
The existing Firebase BOM selects Messaging 25.0.2 and its supported legacy token
API; no newer installation-ID mode is enabled by assumption.

Sign-out intent disables auto-init, persists a removal, clears local authority
and blocks reactivation before Firebase Auth clears its user. The post-sign-out
hook explicitly records that cleared account. SDK deletion runs asynchronously.
Authenticated server removal is now attempted before clearing Auth, with a bounded
deadline and a durable sign-out intent. The connected isolated test confirms this
acknowledgement using a synthetic token; real SDK removal remains unverified. A
pending removal cannot be replayed as a different user. Neither the runtime hooks
nor actual SDK registration/deletion have physical evidence yet.

## Remaining Delivery Work

The Android receiving service now accepts exactly `type=teamMessage` plus an
opaque `notificationId`, with no notification payload. It enqueues normal durable
WorkManager work rather than starting an unowned asynchronous network request.
Both worker display and authenticated activity opening obtain a current confirmed
installation lease, call the resolver below, then recheck account epoch/revision
before consuming the result. New token synchronization is serialized with this
resolution; sign-out and permission withdrawal synchronously invalidate it.

Only generic native copy is posted. Its immutable explicit activity intent
contains no team destination or message text. A cold start, warm intent, second
tap of the same alert, foreground return and explicit read retry all revalidate
before showing the team route; the route separately checks current history access.
Logical withdrawal is unavailable, while transient read failures offer explicit
retry. No alert or message read is implicit. Native cleanup removes only the app's
team alerts and cancels their queued work, not ride-service notifications.

Normal work can be delayed by the OS; no alternate transport or expedited-quota
fallback is added. Unfinished duplicates coalesce, and a stable tag updates an
existing visible alert, not an exactly-once guarantee after dismissal or process
interruption. The dispatcher and its provider retry/uncertainty policy remain to
be implemented. Native UI/platform cases are compiled locally but still need
execution, followed by actual provider/phone tests; no delivery proof is accepted.

`resolveTeamPushAlert` is the read-only server boundary for future native display
and tap handling. It requires authentication, the installation's private proof
and its current registration revision, an active account-owned registration, and
an exact reverse token binding. It reuses current adult and team-notification
authority in one transaction, including the message identity, current team
instance and admission-time boundary. Missing, foreign and withdrawn alerts all
return only `{status: "suppressed"}`. Malformed registration/index/owned-alert
metadata fails closed; nothing is repaired or silently re-registered.

An available result contains only generic copy, the alert ID and a validated team
reference. No message text, names, child identities, token, proof or URL is returned.
The required `purpose` distinguishes `display` from `open`: already-read alerts
are suppressed for display, while an authorized tap may still open the current
conversation. Neither purpose acknowledges the alert or message. Resolution does
not send push, render a notification or open a native screen. Native consumers
must also reject stale account/lifecycle callbacks before display/navigation and
re-resolve on every tap; a previously available result is not lasting authority.
After token refresh, a new attempt uses the latest local revision; an opaque alert
is not permanently bound to the old token revision. The isolated callable trial
uses synthetic registrations and no provider calls, not real closed-app evidence.

Verify authenticated online sign-out removal and the existing native
callbacks, permissions, SDK token lifecycle and offline cleanup on actual phones.
Do not infer these outcomes from the compiled adapter or injected SDK-task tests.

The outbox dispatcher must recheck current account status, current team identity,
adult/guardian admission and the message's admission-time boundary before sending.
It must not equate provider acceptance with phone delivery. Stale/invalid tokens,
partial failures, deduplication and uncertain outcomes need explicit handling.
No content-bearing automatic system-tray payload may bypass current-account
checks on the device. Notification taps must authenticate and recheck authority;
they cannot reveal old history or acknowledge messages implicitly.

The isolated registration suite uses synthetic tokens and makes no provider sends.
It is a server contract trial, not real token registration or closed-app proof.
Actual Android delivery/tap/account-switch/permission/revocation trials and iOS
coverage remain required before release acceptance. There is no deployed change
or new paid infrastructure in this work.

The release manifest now requires six explicit operational proofs: closed-app
delivery, tap navigation, current-account isolation, revocation suppression,
permission lifecycle and sign-out cleanup. All remain pending on both release
platforms. In-app alerts, local models, SDK compilation and provider acceptance
cannot satisfy these requirements.

## Screenshot Decision

On 1 November 2026 the owner explicitly chose to preserve screenshots and video
recording on Android 12 and earlier for now. No `FLAG_SECURE` is added; those
versions do not gain task-preview protection. Android 13+ continues to disable
Recents snapshots without blocking foreground captures. Android 15 was tested;
this choice does not retroactively establish older-device physical proof.

Provider references: [registration lifecycle](https://firebase.google.com/docs/cloud-messaging/manage-tokens)
and [Android receipt](https://firebase.google.com/docs/cloud-messaging/android/receive-messages).
The current app SDK uses the supported legacy registration-token path; adoption
of newer installation-ID APIs is not assumed without a matching SDK update.
