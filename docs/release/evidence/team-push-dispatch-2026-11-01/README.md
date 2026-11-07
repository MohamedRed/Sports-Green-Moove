# Team Push Dispatch And Native Component Recheck

Fourteen isolated service cases pass using real local transactions/current-account
authority and an explicitly injected transport. The backend's 611 unit cases pass,
including 22 dispatch cases. No messaging provider request, production deployment,
phone registration or real notification delivery is performed. Owned data is
destroyed, both admin clients close and the four local endpoints are verified closed.

The dispatcher creates one frozen recipient job per original audience member, then
freezes at most twenty current device revisions per recipient. Both transitions
are transactional and replay-safe. Each attempt rechecks current adult/account,
team/guardian/history, unread-alert, registration fingerprint and reverse token
owner before claiming a ten-minute lease. No provider call occurs in a transaction.
The data payload contains only an opaque alert reference and its type. The phone
must still revalidate access before showing generic copy or opening a conversation.

Provider acceptance is not device delivery. Temporary/unknown outcomes retry up to
five attempts within a one-hour alert window. An expired lease can replay an
uncertain send: this is at-least-once best effort, not an exactly-once guarantee.
Native tag coalescing only applies while a notification remains visible. Invalid
tokens/configuration failures remain explicit terminal records, not successful
delivery. Registrations are not deleted from an old in-flight response, protecting
new account/token bindings; invalid-token pruning/recovery still needs follow-up.
Recipient `complete` means all attempts are terminal, not all were accepted. Root
`queued` means recipient jobs exist, not that notifications were sent. Isolated
function triggers are explicitly disabled; the service trial calls the injected
transport directly. No alternate transport or production fallback is introduced.

The first trial's expiry fixture used a timestamp captured before creating its
second message, so that new envelope had not actually expired. Keep that failed
assertion and source. The corrected fixture derives expiry from each envelope's
own committed timestamp. It changes no production expiry threshold.

At source 11c423b, the independently retained native alert lane passes eight route
and four platform/worker cases with injected resolution. It posts a generic native
notification on a virtual device, verifies cleanup leaves unrelated notifications
alone, and restores the original notification permission and disposable device.
The reviewed narrow/landscape originals remain in the original CI archive; no new
Site media is published. This does not verify provider receipt or a real phone tap.

The separate ride-stop trial reaches and captures its final empty-ride screen but
fails during ActivityScenario.close at transitional STARTED. Its success marker
and host verifier are not reached, so the case and whole workflow stay failed.
The candidate explicitly finishes the owned activity and waits for DESTROYED
before scenario disposal; it compiles but needs execution. No exception is ignored,
timeout extended or failure converted to success. All physical tracking, operational
push, urgent-email and safety-audit release requirements remain pending.

References: [event replays](https://firebase.google.com/docs/functions/firestore-events),
[message lifetime and acceptance](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan),
[Android priority](https://firebase.google.com/docs/cloud-messaging/android-message-priority).
No new cloud resources were provisioned; future deployment must preserve the
existing instance/cost limits. This source-only work needs no Terraform resource change.
