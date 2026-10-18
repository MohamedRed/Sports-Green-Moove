# Lossless Membership And Guardian Pagination

## Reproduced Defect

A valid individual club ID can be 256 characters, but a membership document ID
also includes its user prefix. The old cursor decoder reused the 256-character
individual-ID schema and rejected the combined ID it had just emitted. The
original six-case test has five failures and one pass in `unit-before.json`;
the unchanged cases have six passes in `unit-after.json`. No failed raw report
was rewritten as green.

The fix validates document identity separately: valid UTF-8, at most 1,500 bytes,
no slash, reserved name or dot-only ID. This follows the
[Firestore document ID constraints](https://firebase.google.com/docs/firestore/quotas).
The bounded opaque cursor envelope is 16,384 characters so escaped document IDs
and scoped context round trip without truncation. Inputs reject malformed UTF-8,
noncanonical base64url, extra fields and oversize frames. Existing version-one
tokens retain their format; no alternate/fallback decoder is added.

All membership/guardian/team inputs now share that bound. Browser membership and
guardian readers and the Android guardian/team reader use the same limit. Chat,
reservation and trip-history protocols are separate and unchanged. Current
membership decisions also accept the valid combined ID and check its canonical
stored user/club identity before updating it.

## Actual Evidence

- `services-verified.json`: eight isolated authenticated transport groups, eight paged
  directories, 20-row first pages and complete continuation without duplicates.
  Four directory tokens exceed the old 2,048-character bound. A foreign account,
  another list/club, a revoked manager, malformed tokens and a noncanonical
  record remain denied. One actual local membership approval advances the
  counter once and creates one audit/notification record; replay is rejected.
  A noncanonical pending row also stops the manager queue instead of offering
  an approval that cannot succeed. `services.json` retains the earlier pass
  before that additional queue assertion; it is not current-source proof.
- Pagination fixtures explicitly include 21 synthetic clubs, 21 requested
  guardian rows and 21 requested team-enrollment rows. They are not claimed as
  user enrollment requests, verified guardians or team approvals.
- `android-token-unit-tests.xml`: four actual local unit passes, covering opaque
  preservation, null versus invalid state, long IDs in guardian/team page maps
  and rejection rather than truncation. No native SDK continuation is accepted.
- The browser decoder is executed by `membership-cursor-contract.test.mjs`,
  including its guardian-page consumer and the same boundary/invalid values.

## Historical Proof

`historical-sources.json` pins seven exact source files from
`9c9d94659c196b24cd6f1005ec4f8f8f07865953`. Earlier guardian and team reports
still retain their original bytes and hashes. Their tests explicitly select the
corresponding old pagination files; unchanged sources still bind current files.
Those old reports do not prove the new envelope. The current six-case unit,
eight-group transport and decoder evidence establish the new contract separately.

This does not deploy code, prove native long-ID navigation, live push, team chat,
physical tracking or safety/payment readiness. No production writes or paid
provider requests were used. No infrastructure resource or Terraform change is
required. Coordinated server/web/Android release and the remaining app/device
scenarios are still required.
