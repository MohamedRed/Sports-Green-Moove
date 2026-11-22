# iPhone Native-Location Shutdown, 4 November 2026

## Reproduction

The exact authentication implementation from
`a226b3e265c78f58d56af892a666ae2778afc50b` admits an email login while a previous
native-location start is still unsettled. Its unmodified authentication file is
substituted into the current controlled native-check harness, with the candidate
protocols, location state and test gateways. The actual old method starts one
authentication request before the pending work settles; the assertion fails with
SIGTRAP. This is not execution of the entire original app or a real SDK login.
The same source's profile button has an empty action; no rendered baseline trial
is claimed.

## Correction

Location ownership now exposes pending starts/uploads and a completion-driven
wait. Revocation still immediately detaches the manager, stops local capture and
cancels upload tasks, but their handles and ownership tokens remain until their
actual asynchronous completions. Every waiter resumes only when all tracked work
settles; cancelling a waiter does not make cleanup complete.

Account/role invalidation retains one shutdown task. All five authentication
paths and new ride admission remain blocked until it finishes. Capture is revoked
and logout intent/provider identity are cleared without waiting for the transport.
Repeated sign-out does not discard its existing drain. A failed SDK sign-out
still requires the existing explicit cleanup retry after location work settles.
Trip controls are disabled while their role's tracking work is unsettled.

The profile action now calls the actual sign-out method. A new UI case taps that
button and requires the authentication screen, no old profile/ride and an enabled
empty login form. It is added to the complete fixture bundle, without narrowing
the original seven cases. This eighth case has not executed yet.

## Verified Scope

The full local native plan compiles and passes under Swift 6. Six delayed
start/upload states cover all five login paths, repeated/cancelled cleanup, SDK
failure and fresh login; role-change ride admission is checked separately.
The actual location-provider source also compiles under complete Swift 6
concurrency with warnings treated as errors, using the existing controlled
CoreLocation module. Delayed initial success/error, two simultaneous continuous
uploads, partial completion, multiple/cancelled waiters and old callbacks pass.
These are synthetic transport/sensor checks, not Apple's SDK or physical GPS.

Selected original result lines and complete controlled-provider output are
retained with their private full-log digests. No exception is converted into a
successful drain, no deadline or test selection changes, and no polling, retry or
fallback is added. No new device, provider request, real account, payment or media
is used.

The earlier 3e7cd40 SDK/seven-case pass remains historical and unchanged. Both
current automated iPhone entries are pending again: this changed source requires
its own SDK-linked build and all eight UI cases. Complete sign-out, other SDK
transport drainage, native payment/browser dismissal, operational delivery and
physical tracking remain unaccepted.
