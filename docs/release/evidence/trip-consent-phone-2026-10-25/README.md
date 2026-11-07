# Trip Change Consent On A Physical Android Phone

25 October 2026, Pixel 9 Pro / Android 15, BrowserStack App Live.
App source: `9b59f3113021c5e03024f083102d6d321fc22049`.
APK SHA-256: `23563b391c8dfd873f6a877c16c80f53dbe3aaf11d14d7d409d25a562180d593`.
Package: `be.sportgreenmoove.app.local`. Loopback-only demo backend reached
through the four-port allowlisted private helper. No production writes, map
requests, real payment, installation guard or device administration used.

## Observed Results

- Driver edits a private price draft from EUR 2.50 to EUR 4.00. Closing and
  reopening the editor preserves it, without creating a proposal.
- Driver proposes the new price to two distinct parents. First acceptance shows
  1/2; second acceptance shows 2/2. Consent alone does not apply the change.
- On a separate booked trip, one parent refuses. The original trip and both
  approved bookings remain intact.
- On a third booked trip, the driver withdraws the pending proposal. The original
  trip and both approved bookings remain intact.
- Ten independent read-only checkpoints pass. All six bookings, unrelated root
  records, authentication claims and live-trip state remain unchanged. Parent
  reviews disclose only that parent's booking; an outsider is denied.

All business actions above came from the phone UI. The observer seeds fixtures
once and subsequently only reads. Its exact four source snapshots are retained.
The saved states cover 187 baseline root records, not every nested collection.
The retained-evidence test additionally binds every original proposal term to
the baseline trip, beyond the narrower live observer assertions.

## Media And Limits

`draft-private.png` is one untouched 960 x 2142 provider export. The other images
are untouched, unscaled 253 x 564 device rectangles from the browser viewport,
not native-resolution exports. Those browser bytes are JPEG despite the original
capture helper's `.png` suffix; filenames and bytes are retained unchanged.
`captures.json` and `capture-provenance.json`
record their distinct provenance. No video was recorded.

A second native export attempt timed out and its Save dialog was cancelled.
No second native export or whole-process restart is accepted. The editor return
is not an app restart. The public tour uses six reviewed viewport captures:
draft returned, proposal, first acceptance, both acceptances, refusal, withdrawal.
The profile and intermediate captures remain internal to the retained evidence.

Application of new terms, route/time changes, supplements, refunds, actual GPS
movement, two simultaneous phones, push, iOS and release readiness remain open.
Older local application/restart evidence keeps its original date and scope.

## Disposal

The observer exits naturally with awaited Firestore termination and Admin-app
closure. The provider acknowledges app uninstall and Stop Session returns to its
idle device dashboard. Its independent package query is unsupported, so package
absence is not proven (`phone-cleanup.txt`). No separate final sign-out is claimed.
The owned private helper exits 130 and acknowledges removal of its handoff
directory. The owned backend exits 130. Both runtime directories and the private
session file are absent; loopback ports 5001/8080/9000/9099 refuse connections.
The owned clipboard is cleared and its temporary credential variables discarded.
