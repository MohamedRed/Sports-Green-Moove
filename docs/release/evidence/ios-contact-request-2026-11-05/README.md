# iPhone Contact Request Transfer

On 5 November 2026, the SDK-linked build for source `84c9b62` fails in
`FirebaseEmergencyContactGateway.swift:31:55`: passing the task-isolated
`[String: Any]` argument to the SDK's `sending` parameter risks a data race.
The exact first diagnostic and note, full terminal job/step metadata, zero-artifact
inventory and old source hashes are retained. The full original job log remains
local; its hash is recorded without publishing the raw log.

This is a compiler failure, not the approved 50-minute deadline expiring. No
fixture-screen test executes. Both capture steps are skipped, no artifact is
uploaded and simulator disposal succeeds. Earlier source-bound successes remain
historical; neither current automated iPhone manifest item is accepted.

The candidate carries an immutable `EmergencyContactRequest: Sendable` through
the async helper instead of passing an untyped dictionary. The dictionary is
constructed only inside the dispatch continuation and immediately transferred to
the SDK. Read, write, child-instance, request-ID, revision and explicit null-removal
semantics are unchanged. The same local-construction rule is applied to the new
rating adapter. Both pre/post account and cancellation guards remain intact.
There is no unchecked sendability, unsafe isolation suppression, dependency
downgrade, timeout increase, retry or alternative provider path.

Ten exact request variants and ten malformed inputs pass the actual local native
checks. The controlled signature check passes with a final Sendable callable
class, matching the callback and transfer declaration in the resolved
[Firebase 12.19.3 source](https://github.com/firebase/firebase-ios-sdk/blob/12.19.3/FirebaseFunctions/Sources/HTTPSCallable.swift).
The local compiler is Swift 6.0; it did not catch the original SDK build failure.
Its check remains a limited preflight, never SDK or UI acceptance.

The unchanged eleven-case fixture inventory still requires a successful complete
SDK-linked run. No image storage, screenshots, real accounts, provider requests,
production writes, payments or phone sessions were added. Team conversations,
physical safety scenarios, actual Phone handoff, operational delivery and real
safety audits remain incomplete. The preliminary group-chat source work is held
outside the canonical checkout, not shipped as a usable or verified feature.

Web Integration Smoke runs the new source/evidence contract and native checks run
the request tests. No cloud infrastructure changes, so no Terraform change is
needed. Site publication preserves its public audience and all existing media.
