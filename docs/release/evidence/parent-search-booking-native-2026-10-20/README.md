# Parent Search And Two-Seat Booking, 20 October 2026

Source `7d93569ce30c77ac0c8035dd25aea86cdcad14c4`; manual Native CI run
`39513673003`, job `118940563992`, artifact `12306877088`. All three manual-run
jobs pass; ordinary replay, six separate safety jobs and iOS intentionally skip
in this manual run. The separate PR replay has its own outcome.

The actual Android app signs in as the isolated parent, selects provider
suggestions for Wavre and Brussels-Central, selects Lina and two seats with
consent, searches one genuine eligible future trip and requests it. The app then
signs out/in as the driver, approves through its reservation confirmation, signs
out/in as the parent, observes approval and cancels through confirmation.

Three independent read-only host checkpoints verify requested, approved and
cancelled saved state, the same parent/child/trip, two seats, one committed free
request receipt and one approval/cancellation notice each. Capacity is 4 before,
4 requested, 2 approved, 2 after switching back, 4 cancelled. Final verification
finds unrelated documents, all user claims and live trips unchanged. No host
creates, approves or cancels the booking.

Six real provider HTTP calls, all HTTP 200, are retained: two suggestions, two
place details, one 3-by-3 matrix (nine elements), one final route. The approved
ceiling was eight; no retries or substitute routes were used. The remaining two
requests are not permission for a new trial. The server credential never enters
the APK, local service credentials, retained evidence or portal.

The mandatory primary evidence copy succeeds. Raw instrumentation, six original
1080-by-2400 captures, markers, provider receipts, checkpoint states, source
bindings and independent cleanup remain byte-pinned. Thirteen exact tested
source files are retained by SHA-256 in `../source-archive/`. The artifact digest
is GitHub-provided metadata, not a locally recomputed ZIP attestation.

Four original captures are visually reviewed and published: choices, requested,
driver-approved, cancelled. The match capture partly hides the card below the
viewport; parent-approved still has loading text. Both remain original archived
evidence but are excluded from the portal. No screenshot is relabelled or edited
to remove an inconvenient state.

The local service environment is destroyed, its endpoints close, the admin
client and checkpoint server close, own APKs are removed. The separate device
receipt verifies the continuous installation guard and restoration of the
launcher/background settings, original policy and removal of temporary device
administrator authorization/component.

This is one local app trial across two accounts on one disposable emulator,
using real map responses, not two physical phones, physical GPS, payments,
refunds, guardian consent audit acceptance, deployed production or complete
release readiness. Replaying on a physical phone and the remaining release
requirements is still necessary. Existing dated physical-phone evidence remains
separate and is not refreshed by this run.
