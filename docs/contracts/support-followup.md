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
- Android: seven JVM wire/state cases; new Compose cases compile but still need
  execution. iOS: model/state checks and local Swift package compilation, not an
  iOS Firebase-linked build or simulator/physical UI claim.
- Retained artifacts: `docs/release/evidence/support-followup-2026-10-22/`.

The new requester screens still require observed native and physical replay.
Local device startup failed for lack of free disk space; the newly created
disposable virtual device was deleted. No installation policy was changed.
The prior phone submission proof remains valid only for its older pinned app.
The latest pushed native run at base `9a44bf4` failed; the overall gate remains
open. New bounded host-process observations around evidence transfers improve
diagnostics without retrying a transfer or claiming its outage is fixed.
