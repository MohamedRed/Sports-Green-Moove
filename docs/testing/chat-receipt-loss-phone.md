# Chat confirmation lost after commit

This manual trial uses isolated accounts and a real native phone UI. It does not
prove radio loss, a second physical phone, production messaging, or release readiness.
The controller must never submit the parent's message or infer UI success from records.

## Preparation

Use a fresh owner-only directory and the existing
`scripts/qa/start-review-receipt-loss-runtime.mjs <private-handoff-path>` runtime.
Despite its historical filename, this runtime only starts empty disposable services:
Functions upstream on loopback 5002 and the other existing services on 8080, 9000,
9099. It does not seed a review or send anything. The new chat facade owns 5001.
Only the previously approved 5001, 8080, 9000, 9099 may be tunneled; 5002 stays local.
No maps, payments, production users, or additional tunneled ports are involved.

Run `manual-chat-receipt-loss-session.mjs` in a TTY with absolute paths for the
private handoff, new private app-session file, existing owner-only output directory,
and isolated APK. The runtime password must only be used through private input.
The facade rejects other mutations after preparation and latches any setup failure.

## Ordered Observations

1. `parent-ready`: sign in as the synthetic parent. No target-conversation message exists.
2. `conversation-open`: open the newly approved booking conversation, not seeded history.
3. Send exactly the parent body exported by `chat-network-phone-checkpoints.mjs`.
   The facade freezes the phone UUID, forwards once, verifies the actual stored
   message and notification, then destroys its successful callable response.
4. `receipt-lost`: independently retain that verified commit and withheld response.
5. `recovery-ready`: retain unchanged records, then explicitly permit identical retry.
6. `parent-confirmed`: observe one sent message. If the real live listener already
   reconciles it, do not force another send. Otherwise retry the same pending item.
7. `parent-reopened`: leave and reopen the conversation; observe exactly one message.
8. `driver-visible`: sign in as the synthetic driver, open that conversation, observe
   one incoming message and verify its read acknowledgement independently.
9. `signed-out`, then `finish`: sign out and finish ordered record checks.

Retain original server timestamps, the phone's original UUID, one notification,
and unchanged foreign records, claims, bookings and live trips. A changed UUID,
unverified commit, duplicate, unexpected mutation, or failed checkpoint invalidates
the attempt. Preserve failed and partial trials; do not relabel them as passed.

Separately retain reviewed UI/session captures and device connection observations.
No observer-generated JSON alone proves a phone action or installed APK bytes.
Stop the controller, close the disposable phone, stop only the owned tunnel and
runtime, and independently verify that private files and all owned ports are gone.
