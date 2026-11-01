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

## Remaining Delivery Work

Native installation-proof storage, serialized revision allocation, token refresh,
permission changes, sign-out removal and account-switch handling must call this
boundary. Do not add a native success claim until the actual phone path runs.

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
