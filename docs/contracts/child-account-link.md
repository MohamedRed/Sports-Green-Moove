# Child Account Linking

## Decision, 26 October 2026

The child's verified parent approves linking an existing child login to the
child's profile. Club managers still verify the parent-child relationship;
their manager role alone cannot approve a login link.

## Implemented Protocol

- The signed-in, already provisioned child account requests a random 128-bit code
  with `createChildAccountLinkCode`. No user ID or role is accepted from the client.
- The server stores only a SHA-256 code fingerprint, not the code. Requests expire
  after ten minutes. Explicit regeneration has a one-minute cooldown, removes the
  previous request, and cannot bypass an existing account link.
- The parent selects a currently verified child in their emergency-contact settings
  and enters the code. `approveChildAccountLink` rechecks the parent's role,
  membership, manager verification, immutable child identity and guardian relationship
  transactionally. It also rechecks the child's current account role.
- Approval creates the server-owned link and consumes the code atomically. A lost
  response can be retried explicitly by that same parent for that same immutable
  child. A consumed code cannot rebind the account. Current parent authority is
  required even for a replay; revoked links are not reactivated.
- Clients, including administrators, cannot directly read or write links, approval
  requests or request-owner records. No custom claims are granted by this protocol.
- Android code and input are memory-only and cleared on background, account change
  and disposal. Late responses cannot reopen a prior account's code or approve its
  selection. The server remains authoritative after an uncertain response.

## Location Permission

The owner also approved retaining emergency-contact access when location is denied.
Android now offers a separate child contact action from Trips and resolves the same
active ride from Options. Neither path starts tracking or enters its permission
gate. The contact read still requires the linked child and an active ride, and
revalidates the parent-chosen contact before a dial-only handoff. No offline contact,
guessed number, location grant or tracking fallback is introduced.

## Verification And Remaining Work

Ten authenticated local service groups passed, including code regeneration, expiry,
concurrent approval, current-authority rejection, replay and the linked child's
contact read. Four navigation-policy and ten pairing-state JVM cases passed.
Evidence: `../release/evidence/child-account-approval-2026-10-26/`.

Four additional Android UI cases are prepared for the existing complete matrix:
two assert that location is actually denied and two exercise the pairing dialogs.
Compilation is not proof that these cases ran or that a dialer opened.

This does not provision child accounts, grant child roles, supply credentials,
resolve normal child trip discovery, add parent link-revocation management, or
rewrite live-stream identities. Those workflows and iOS integration remain open.
No production deployment, physical-device result or store-review acceptance is
implied. Existing preseeded-link evidence retains its original scope and date.

## Dedicated Child Contact Discovery, 26 October

`getCurrentChildRideEmergencyContact` accepts a strict empty object. A pure-child
token and current stored child role are required. One transaction reads the
server-owned verified link, validates the immutable child profile, selects its
newest active ride through the existing child-profile/status/start-time index,
and applies the same contact authority checks as the known-ride endpoint.
It returns `{ accountUserId, current }`, where `current` is the child's own minimal
contact view or explicitly null when no active ride exists. Invalid links and
invalid latest rides are errors, not absence and not a fallback to older rides.

Android child sessions skip adult ride bootstrap. Trips offers the independent
contact action even without an adult ride snapshot; Options uses the same child
discovery path. Pairing stays accessible on an unlinked account. Background and
account disposal clear private data, and a dial-only action still rereads the
displayed ride's contact before handing off. Parent/driver ride behavior is unchanged.

The isolated authenticated replay and fifteen focused JVM cases are retained in
`../release/evidence/child-contact-discovery-2026-10-26/`. This fixes contact
discovery only, not general child tracking, signup, iOS or the incomplete phone
approval journey. The component APK builds; no connected component execution or
physical dialer result is accepted from this local replay.
