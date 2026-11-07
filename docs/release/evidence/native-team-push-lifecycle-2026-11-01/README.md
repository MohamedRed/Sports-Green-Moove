# Native Team Registration Lifecycle, 1 November 2026

Twenty-four new JVM cases run the production lifecycle coordinator (21) and
the SDK-task serialization queue (3) with synthetic tokens and controlled task
completions. The original 27 journal/wire cases still pass. The complete Android
JVM suite passes 746 cases; app and test APKs compile. No device or instrumentation
execution is accepted by this local result.

Production source now starts registration from the application, authentication
changes and foreground resume. Notification permission includes both the global
setting and the team channel. New-token callbacks request a fresh SDK read rather
than trusting an unscoped callback token. Children and uninitialized claims do not
start token acquisition; server-side current-account/admission guards remain
authoritative. SDK auto-init starts disabled and enables only for an eligible,
permitted binding. Errors disable auto-init and preserve retry state.

The coordinator serializes requests, replays a lost response with its exact
revision, and rejects late token/deletion/registration completions across account
epochs. Sign-out intent immediately blocks reactivation, including before the
Auth SDK has cleared its current user. The explicit post-sign-out hook records
the resulting null account so re-login does not depend on observing every queued
Auth callback. Signing out remains possible if private registration state fails.

A 20-second operation bound does not silently restart the attempt. Only a later
auth/resume/token event retries. Cancellation does not cancel a provider SDK Task:
the queue retains that task and waits for its terminal state before starting
another token operation. Thus an old deletion cannot overtake a new acquisition,
or an old acquisition finish after its replacement's deletion. The three queue
tests execute real Task completion primitives, not real provider requests.

Sign-out invalidates local authority and schedules provider-token deletion.
An authenticated server-removal acknowledgement before Auth sign-out is **not**
implemented/verified here. A retained removal can be replayed only as its original
user; another account must pass deletion before a proof-bound transfer. The
pending server-removal/online-logout sequence remains work, not an accepted flow.

No actual Firebase token was acquired, deleted or registered; runtime hooks and
the SDK adapter are compiled, not device-tested. Firebase Messaging 25.0.2 is
selected by the existing 34.14.1 BOM. The supported legacy token API is intentionally
retained to match the server token registry; no SDK/installation-ID migration is
assumed. The isolated APK manifest disables auto-init, delegation and the custom
messaging service. Local tests never enable the production runtime.

The service currently handles token refresh only. No message dispatcher, closed-app
delivery, notification display or tap navigation is implemented or accepted.
Physical, iOS, production, support-email, GPS, safety-audit and final release
requirements remain separate and open. No new paid request, real account,
infrastructure, map or payment is used.

`review.json` binds source hashes before/after the successful build, both APK
digests and all 110 JVM reports. Host names/home paths and trailing whitespace
are normalized as documented by the recorder; checksums cover every artifact.
The raw private build log is not published on the progress Site. Previous
journal evidence, phone captures, tours, dates and public access remain intact.
