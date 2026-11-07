# Native Tracking Ownership Repair Prepared

The original unit XML preserves 18 passing cases: eight immutable native tracking
lease cases, six explicit owned-ride resumption cases and four provider shutdown
ordering/failure cases. The original successful build output and source bindings
are retained. These are actual Kotlin unit executions with explicit test doubles
for external services, not native app, provider SDK, GPS or physical-phone proof.

The service now binds each callback and upload to an immutable account, ride,
role and sign-out revision. Pending starts cannot survive sign-out/relogin to the
same user. Auth changes stop the service, cancel upload work and remove location
updates; destruction removes the observer. Unknown roles and null restart intents
are rejected. Explicit sign-out invalidates starts before stopping local sensors
and requests the existing SDK local stop without completing/cancelling a ride.
All provider sign-outs are attempted even when an earlier provider raises an error.

Resuming from Trips renews native location only for the authenticated owner of
that existing ride, behind its existing permission gate. Parent viewing does not
start sensors. Resumption does not create another ride or start/complete a provider
trip. The product notice no longer exposes implementation names.

The expanded native scenario still requires both actual dial-only handoffs,
unchanged passenger state, parent service absence, driver service resumption,
original pickup/dropoff/completion/ledgers/rating checks and independent storage
verification. Five tracking observations must match the actual run and actors.
The unchanged assertion that exposed the bug is not skipped or weakened.

This compiled repair has NOT yet executed that app scenario. Its original failed
run remains negative in the separate account-failure directory. Live provider
resumption, SDK callback timing across account changes, real GPS, OS restarts and
physical tracking requirements remain open. No store-review acceptance, provider
request, real payment or production change follows from these unit results.
