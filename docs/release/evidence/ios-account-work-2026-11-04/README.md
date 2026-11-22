# Account-owned publication and refresh, 4 November 2026

Local checks against actual production models/controllers, with synthetic gateways.
This is not a rendered iPhone logout, complete SDK transport drain or release pass.

## Original Failure

The production `PublishController` at
`20ca1458b9927fa354a1586c261c166d9b77d016` accepts a delayed publication response
after `AppState.signOut()`. Its notice callback writes into the signed-out app.
`baseline.txt` retains the failed regression (exit 133, restoredNotice=true).
The new fixture/probe compile against the unchanged production bodies; this is
not a historical full-app build. The candidate runs the same sequence without
restoring the notice. `native-checks.txt` retains the complete successful command.

## Ownership And Drain

`AccountWorkScope` binds access to a unique account/role generation. A captured
handle never becomes valid again after sign-out, same-UID return, another account,
role round-trip or grant revocation. Revocation retains unsettled work tokens.
Finishing an old token cannot release another request. New-generation work cannot
start until old-generation work settles; parallel work within one current context
retains independent ownership. Cancelled intents do not register work.

Publication, address suggestions/resolution and atomic app-data refresh now hold
these tokens around their asynchronous work. Authentication is blocked while
registered old work drains. A publication callback receives its original typed
access for follow-up refresh, not whichever account happens to be current later.
The authenticated view tree is keyed to that context, and the publication view
owns a bound controller. Disappearance invalidates its callbacks; reactivation
cannot revive an earlier request. Duplicate controller actions are denied while
the current action is pending. Private resolved places are not applied after
revocation. No retry, fake profile, alternate provider or guessed data is added.

The ordinary refresh fixture now explicitly grants both parent and driver roles
when testing authorized role changes. It no longer assumes an ungranted driver
role can load private data. Existing refresh races still execute.

## Coverage And Remaining Work

The actual native checks pass 42 held publication/suggestion/resolution cases:
success/error across logout, another UID, same-UID return, role round-trip, grant
revocation, closed/reopened view and cancellation. Current publication success,
duplicate denial, explicit retry and reactivation also pass. The shared scope
checks independent tokens, revocation, cross-generation drain and cancellation.

Other controllers/operations are **not yet fully enrolled**: payment presentation
and onboarding, messaging/reviews, booking/approval and search request transport,
continuous location upload drain and remaining provider SDK cleanup still need
their own proof. The profile logout action remains unwired until that work is
safe. The iPhone publication form's real club/team selection and persistent draft
requirements also remain open; synthetic drafts here do not accept those flows.
The original controller still had hardcoded form data, which this ownership change
does not pretend to validate. No customer, payment, real map or phone is used.

The SDK-linked/rendered candidate and both platforms' physical scenarios,
operational notifications and safety audit receipts remain required. No release
manifest status changes. Publish one short local note, preserving all prior flows,
media, phone dates, tours, partial statuses, blockers and public access.
