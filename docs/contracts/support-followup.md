# Requester Support Follow-Up

Support requesters can open **Mes demandes** from Options, read their own
submission, its current status (Reçue / En cours / Clôturée), and written staff
responses. Lists and histories load explicit bounded pages. Refresh re-reads the
current state; no push notification is promised by this implementation.

## Privacy Boundary

`listMySupportReports` and `getMySupportReport` derive ownership from the verified
session, never a supplied user ID. Missing and foreign tickets return the same
not-found result. Only explicit public fields are projected. Internal review
notes, review events, staff IDs and operation metadata remain private. Raw report,
reply and operation reads remain denied to ordinary clients by existing rules.
There is no alternate raw-collection or legacy endpoint fallback.

Android and iOS check account identity before and after reads, dispose account
scoped state, discard late navigation results, and fail closed on malformed,
duplicated, contradictory or changing pages. A changed history during pagination
requires explicit refresh rather than silently mixing versions.

## Administrator Responses

The separate public response form captures an immutable UUID, text, intended
status and expected reply count/status. `respondToReport` requires administrator
claims. One transaction stores an immutable public reply, advances its sequence,
updates status and records a private idempotency operation. Private notes are not
copied or overwritten. Exact replay returns the original receipt, including
after a later private status change; changed reuse and stale competing responses
are refused. Distinct concurrent sends cannot both advance the same expectation.

A lost acknowledgement keeps the exact captured action for an explicit retry.
The form does not automatically resend or generate a replacement identity while
confirmation is unknown. Editing and private status actions stay disabled until
that send is resolved. Signing out removes the controls. Existing private review
actions remain separate; they do not implicitly publish their internal notes.

## Infrastructure And Verification

The reports owner/creation-time/document-ID index is codified in
`firestore.indexes.json`, the existing repository deployment source. No cloud
resources or production index/function deployment was performed for this work.

- `npm run test:support-followup`: 13 real isolated service scenarios.
- Optional `--browser`: five administrator-browser checks, including actual
  post-commit acknowledgement loss and explicit retry, at widths 1440/768/390/320.
- Android: seven JVM wire/state cases and two executed Compose cases pass.
  Their exact ordinary-suite XML is retained with the failed full native run.
  iOS: model/state checks and local Swift package compilation, not an
  iOS Firebase-linked build or simulator/physical UI claim.
- Retained artifacts: `docs/release/evidence/support-followup-2026-10-22/`.

The 22 October physical Android follow-up now verifies one UI-created request,
two written replies, status changes, reopening and sequential account isolation.
Eight independent checkpoints preserve 158 original records and account claims;
nine reviewed images (eight stream rectangles and one full browser context) are retained separately under
`support-followup-phone-2026-10-22`. The administrator publishes these responses
through authenticated services, not its phone UI. Native PNG export and recording
are unavailable; no replacement video or process-identity claim is invented.
The app, session, owned backend/helper and credentials are disposed with receipts.

The earlier local device startup failed for disk capacity and that new virtual
device was deleted. Historical submission-only proof remains tied to its older
APK. The full native run at `e23809a` fails during evidence transfer despite
145 ordinary cases and eleven focused lanes passing. Before/after host process
observations remain diagnostic, not root-cause proof or an alternate transfer.
Urgent-mode and lost-connection submission scenarios remain unverified on phone.

## Submission Recovery

New Android/iOS callers use only `submitSupportReport`. Each action captures a
UUID, verified account and immutable content before any request is sent. A server
transaction creates one report and a private `supportSubmissionOperations` entry.
Identical retries return the original receipt without resetting later review
status, notes, replies or timestamps. Changed reuse, foreign requester identities
and inconsistent saved records fail closed. The raw journal remains private.

The native form stores its unresolved action in private, non-backed-up storage.
It restores the same content when reopened, does not resend automatically, and
locks editing until an explicit retry is acknowledged. Cancellation, late account
results, malformed receipts and storage failure cannot silently discard or replace
the identity. Successfully acknowledged sends clear only the matching operation.

`npm run test:support-submission` covers twelve real isolated service cases,
including post-commit response loss. Twelve JVM cases, Swift model/state checks,
two executed Android component cases, four screenshots and a ten-second excerpt
are retained in `support-submission-recovery-2026-10-22`. The component transport
is simulated and separate from those services. This is not physical-network or
app-process restart proof, urgent escalation, or a production deployment.

The old `createReport` remains unchanged for installed builds. It is not an unused
fallback: new callers never invoke it, even on failure. Deploy the new callable
before distributing the new apps; retire the old callable only after the installed
client compatibility window is explicitly closed. Existing historical evidence is
not relabeled as verification of the new submission protocol.
