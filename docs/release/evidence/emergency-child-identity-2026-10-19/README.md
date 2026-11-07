# Emergency Contact Bound To Immutable Child Identity

`before.json` is the unchanged isolated reproduction at 12:57 UTC on 19 October.
After deleting and recreating the same child document, both an old verification
and an old committed operation still allowed the previous contact to be read.
Fresh verification also returned that old contact. All accounts, numbers and
records were fabricated in a disposable local session; no production access or
phone handoff occurred. The obsolete probe source is archived by exact hash and
removed from executable scripts, not retained as an accepting regression test.

The correction binds child contacts to a SHA-256 identity derived from their
actual server creation seconds/nanoseconds, not a client-editable date. Every
child write must include the exact identity of its displayed view. Reads and
writes require a manager decision newer than both child and club creation.
New identities use separate private documents and versions, so re-verification
cannot inherit a prior child's contact or operation. Adult keys, responses and
idempotency fingerprints stay unchanged.

The child name, club name, authority and immutable identity now come from the
same contact transaction. Android no longer combines a separate guardian read
with later contact data. It validates the returned identity/club, binds writes
and receipts, clears mismatched readback and requires another tap before dialing
a changed child identity even when number and revision match.

An unbound legacy child document is not silently ignored, migrated, deleted or
used as a fallback. Its existence causes an explicit failed-precondition until
an approved review/migration is performed. No production migration or deployment
was performed. Coordinated callable/client rollout is required; old child
writers without the new identity marker fail closed. No rule/index/Terraform
resource change is required because both collections remain server-private.

Retained completed checks:

- `services.json`: eleven actual authenticated isolated identity groups, including
  fresh re-verification, stale zero-version forms, operation collision, concurrent
  recreation, club recreation, malformed records and legacy denial.
- `baseline-services.json`: all sixteen existing contact service groups still pass.
- `fixture-services.json`: five service-only fixture checks. Preparation uses an
  actual parent request and a separate manager approval, not preseeded authority;
  exactly three contact operations and protected cleanup are independently checked.
- Original XML: nine transport and twenty state unit cases, no failure/error/skip.
- `functions-unit.json`: eight actual domain unit cases. The app and test APKs
  also compiled; compilation is not native UI execution.

All original reports and artifacts are hash-bound, and their exact source bytes
are retained in the content-addressed archive. These checks do not accept a new
native or physical replay, active-ride entry, full-process restart, the child's
separate own-account dial path, a real call or any release-manifest requirement.
Older screenshots in `local-contact-dialer-pass-2026-10-18` keep their original
preseeded-fixture scope and date. The corrected contact flow still needs fresh
native and phone verification before it can be presented as a new phone result.
