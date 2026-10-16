# Local Trip Details Write Boundary - 2026-10-16

## Reproduction And Verification

The owning driver could directly change operational details of an already booked
trip, bypassing the server operations and the parents' original reservation.
The removed blacklist is replaced by an allowlist of the existing cosmetic
`title` field. All other fields remain server-owned for ordinary clients, including
future fields. The explicit administrator policy and the legacy title policy are
preserved. No native trip editor or new editing policy is introduced.

Original, unedited reports are SHA-256 pinned in `artifact-sha256.json`:

- `sgm-trip-details-rules-before.json`: 33 regression tests, 5 passed and 28 failed
  against the original rules. The failures reproduce 23 operational mutations,
  four removed fields and a bundled title/price change being incorrectly allowed.
- `sgm-trip-details-rules-after.json`: 82/82 passed, including the same 33 cases
  plus all earlier security, inbox, membership, capacity, team and cancellation
  rules. The five preserved-policy cases pass before and after the fix.
- `sgm-trip-details-services-before.json`: run
  `959fe2f396e36f832ae0438bb5fae93c`, `2026-10-16T18:45:22.615Z`.
  20/21 groups passed. The new signed-in scenario failed because the price change
  returned HTTP 200 instead of 403.
- `sgm-trip-details-services-after.json`: run
  `22e1a2d2d04de02588158606ab0ff206`, `2026-10-16T18:48:30.809Z`.
  21/21 groups passed. Fourteen owner mutations and three other-actor writes
  returned 403/PERMISSION_DENIED. The entire saved trip and booking were checked
  after each denial. A valid owner title edit changed only the title. Price stayed
  250 cents, two approved seats stayed reserved, route and tracking stayed intact.

The transport check uses real isolated local authentication and REST writes,
including field deletion and an atomic commit; it is not a mocked status code.
The booking's paid flag is explicitly synthetic fixture metadata, not a charge.
All prior service groups ran again, including ride lifecycle, messages, membership,
capacity and cancellation. The local runner tears down its own services.

## Scope Still Open

The full trip-editing flow is **not implemented**. Whether parents must reconfirm
changed time/route/price or the driver must cancel and publish anew is still
awaiting an explicit product decision. Neither policy has been silently selected.
See `docs/contracts/trip-editing.md` for the remaining end-to-end contract.

This fix has not been deployed to production. No live payment/refund, physical
device, GPS/background behavior, push delivery, team enrollment or group chat is
verified by these reports. No new screenshot or recording is claimed for this
service-only check. The prior app cancellation captures retain their original
date and source in `../local-trip-cancellation-ui-2026-10-16/README.md`.

The partner page remains partial and keeps the complete editor, real refunds and
phone replay open. The release manifest is unchanged and release is incomplete.
