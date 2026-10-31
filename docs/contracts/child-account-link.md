# Child Account Linking

## Decision, 26 October 2026

The child's verified parent approves linking an existing child login to the
child's profile. Club managers still verify the parent-child relationship;
their manager role alone cannot approve a login link.

The verified parent also initiates account creation by sending an invitation
(owner decision, 26 October). The parent shares an invitation link from their
phone; the app does not send an automatic email (owner decision, 26 October).
The invitation-first candidate below creates a child login; the separate pairing
protocol then links that login to its profile after explicit parent approval.

## Invitation-First Signup Candidate

- The currently verified parent selects an immutable child profile and creates
  a private HTTPS link. A random 256-bit secret is in the URL fragment, not the
  query string. Only its SHA-256 fingerprint is stored. Unclaimed links expire
  after 24 hours. Replacement has a one-minute cooldown and invalidates the old
  unclaimed link. A pending invitation can be revoked, but a claimed signup is
  not treated as an unused invitation or automatically deleted.
- The child supplies email and a password of 12-128 characters on the separate
  public signup page. All client-selected account IDs, parent IDs and roles are
  rejected. The same transaction pins the invitation to a new reserved account
  and the original credentials. An HMAC request fingerprint uses the unstored
  link secret as its key; raw passwords and link secrets are never persisted.
- A disabled login is created first. Only child claims and the child profile are
  written before enabling sign-in. No parent, driver, manager or admin role is
  temporarily granted. An existing email/account is not adopted, changed or reset.
  A definitive pre-creation email/password rejection releases that reservation.
- A lost response or interrupted disabled-account setup is resumed explicitly
  from the original shared link with the same credentials and reserved identity,
  including after initial-claim expiry. No password is overwritten. Requests are
  limited to five per minute per invitation; changed credentials cannot rebind it.
  Current parent/guardian/membership/profile authority is rechecked throughout.
- Creation does not approve the account/profile link. The existing code/approval
  step remains separate and is pinned to the invited child identity and club.
  Claim, immutable profile, private origin and approval-request fingerprints must
  agree with the accepted invitation. Missing data is not interpreted as an
  unmarked pre-invitation account. Direct clients cannot rewrite the profile marker.
- Android validates the returned origin, fragment, fingerprint, expiry and child
  identity. The link stays in memory and is cleared on background/account disposal.
  An explicit share action opens the system chooser. Status refresh never
  reconstructs a secret. A late response cannot restore a previous account's link.
- The web page removes the fragment from browser history and uses a separate
  in-memory Auth instance, not the manager's persisted session. The child later
  signs in normally in the app; opening the app does not replace an existing session.

Eighteen isolated service groups, eleven focused backend units, ten native state
cases and the rules suite passed. Three native component methods compile but
have not run in the retained preparation record. Web rendering used a fake submit
handler. The complete real-phone share/signup/approval journey and iOS remain
open. Neither the new backend nor signup page is deployed; configuration of the
primary Firebase host does not publish the route or isolated fixtures there.
Evidence: `../release/evidence/child-invitation-2026-10-26/`.

The later binding/role fault replay retains two original failures and the repaired
eighteen-group result in `binding-recheck/`. Missing child role claims now fail
before ordinary-user defaults can run, on both the server and Android response
parsing. Sixteen focused backend units, six extra Android Auth wire cases and 208
rules cases pass. This does not replace missing connected or physical evidence.

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

The pairing protocol alone does not provision child accounts, grant child roles, supply credentials,
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
