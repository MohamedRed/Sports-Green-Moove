# iPhone Account Profile Preparation, 4 November 2026

Local logic and strict signature checks only. No new SDK-connected sign-in,
rendered profile, real signup, native media or release acceptance.

## Source Review

At `a4fa494ac4fb29c41586b16d2896ae292721dcc3`, the iPhone gateway returns only
the SDK identity, ignores the signup name and never calls the existing backend
`initializeUserProfile` flow. The profile displays a fixed person's name, initials,
age-group badge and every role selector. The home greeting and date are fixed.
These are source observations, not claims about a new real-account test.

## Implementation

Separate raw `AuthIdentity` from an initialized `AuthSession`. After an owned raw
authentication result, the same serialized authentication gate awaits preparation
before opening the app or committing restoration permission. A revoked raw
completion never starts a profile write. Failure, cancellation and logout during
preparation use the existing credential cleanup boundary; late profile responses
cannot commit a session or unlock overlapping authentication.

The production adapter uses the existing `initializeUserProfile` callable, with
the exact SDK UID and optional submitted signup name. A typed JSON decoder rejects
missing, inconsistent, duplicate or unknown roles, UID mismatch, non-boolean role
flags and mixed child/adult authority. It then forces a token refresh and checks
that refreshed role claims agree with the response, with UID/cancellation checks
at each boundary. No role is inferred or granted on the device, and no old-profile
fallback is introduced. Server authorization remains authoritative.

The callback signature was verified against the [official User API reference](https://firebase.google.com/docs/reference/swift/firebaseauth/api/reference/Classes/User#getidtokenresultforcingrefreshcompletion).
The local signature check uses controlled module declarations, not the real SDK.

Signup validates the submitted name against the existing 2..160 UTF-16 length
contract before creating credentials. Name forwarding occurs in account
preparation, not the raw identity gateway. Explicit login can recover after a
preparation error without creating another account. A transient restoration error
retains the explicit retry path without accepting an unprepared identity.

The profile and greeting use the initialized name, email and actual memberships.
Only server-granted roles are shown; role changes are guarded again in AppState.
An accepted child-only profile selects the child context, never an adult default.
Missing names remain absent rather than inventing a person. Fixed identity,
age-group, city, notification-state and 2022 date text are removed. Current date
rendering uses a local clock, without network requests. Long labels have wrapping
and constrained scale. Their actual rendering still needs the new native run.

## Verification Boundaries

`native-checks.txt` compiles actual Foundation AppState logic, retaining all prior
checks. The new cases cover strict profile/claim parsing, name forwarding and
pre-call rejection, raw-vs-prepared identity, logout with late success/error,
cancellation, failed preparation and explicit retry, invalid roles/UID refusal,
child role selection, unauthorized role denial and restoration retry.
`signature-checks.txt` type-checks the production adapter against controlled
signatures with Swift 6 complete concurrency and warnings as errors.

The original auth fixture test is extended, not replaced: it retains all identifier
assertions and additionally enters credentials, opens the authenticated home and
profile, and checks the synthetic name and granted/absent role selectors. All
seven original fixture test names and existing workflow budgets remain unchanged.
This test is authored but not accepted on this source until its native run passes.
No screenshot upload or new phone trial is enabled.

Profile logout remains unwired until GPS/provider teardown is safe. Full iPhone
signup, account-role, child invitation, conversations, emergency contact, physical
tracking, operational delivery and audit evidence remain release requirements.
No production records, real payments, infrastructure, audience or media changes.
One concise local progress note is published; all earlier flows, dates, statuses,
tours, blockers and media stay unchanged. Web Integration Smoke and iPhone path
triggers include the new contract checks without removing earlier workloads.

The first local portal browser run stopped at its unchanged 30-second wait for the
appearance gallery heading. `portal-browser-initial-failure.txt` retains that
original failure. After the concurrent build finished, the identical browser
command passed at 320, 390, 768 and 1440 pixels; its log is retained separately.
No test, timeout or portal navigation source was changed. The cause is not
established, and the later pass does not retroactively accept the failed run or
establish an intermittent-navigation repair. This browser proof is only for the
progress website, never the new native account screens.
