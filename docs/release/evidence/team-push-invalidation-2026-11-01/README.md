# Invalid Registration Cleanup

An isolated regression reproduced the defect: a definitive invalid-token reply
left the installation active. The dispatcher now retires that exact binding and
removes its reverse token index in the same transaction as the terminal result.
The installation remains as a revision tombstone; a delayed identical registration
cannot revive it. An explicit newer registration remains possible.

The completion transaction rechecks the lease before cleanup, then checks the
current account, installation, revision, fingerprint, exact token and reverse
owner. Late replies preserve refreshed tokens, account switches, signout and a
token rebound to another installation. Configuration, temporary and unknown
errors do not delete registrations. Conflicting current identities fail closed.
This follows the [provider's invalid-registration guidance](https://firebase.google.com/docs/cloud-messaging/manage-tokens#detect-invalid-token-responses-from-the-fcm-backend).

The final frozen-source run passes all 22 isolated service cases, including eight
cleanup/race cases, with an injected sender and no real provider requests. All 623
backend units pass, including 12 focused cleanup cases. Owned services are stopped,
their temporary environment destroyed, and the four loopback ports verified closed.
The first reproduced failure is retained. An intermediate run passed its cases
but was correctly rejected because I changed its source inventory during execution;
it is not accepted evidence. The final run uses unchanged sources throughout.

No production deployment, real token invalidation, physical phone delivery, tap,
real SDK deletion or release requirement is accepted by this bundle. Existing
physical tracking, safety, support email and operational delivery gaps remain.
