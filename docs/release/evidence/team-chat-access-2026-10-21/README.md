# Multiple Child Grants And Team Isolation, 21 October 2026

Eleven service scenarios completed against owned disposable demo accounts and
backend data. `results.json` and the original execution transcript retain the
actual local result, source hashes, record counts and verified cleanup.

The parent starts with one approved child and a paginated history. Approving a
second child preserves the still-current first grant's history but invalidates
the older cursor. Revoking the first child's guardian agreement leaves access
through the second child only, using that remaining grant's admission boundary.
Removing the last eligible enrollment denies reading, sending, retrying an earlier
message and directory discovery. Another independently verified parent and the
driver keep their own access.

Reapproving the second child starts a new history. Renewing the first child's
guardian agreement preserves the second still-current grant; withdrawing the
second then leaves only the first grant's newer history. Earlier send identifiers
cannot recover a message outside the current boundary.

A parent in the same club cannot discover, read or write another team's
conversation. Substituting a team identity or an original-team cursor is denied.
A pending child enrollment grants nothing. Separate manager approval admits the
parent only to the second team's subsequent messages, without altering the first
team's messages.

Independent stored-state checks verify 57 and 2 messages respectively, contiguous
sequences, distinct message identifiers, matching operation documents and matching
conversation counters. All 158 protected baseline records and original claims are
preserved apart from permitted sign-in timestamps. The admin client closed, the
owned temporary environment was destroyed and all four endpoints were closed.
No cloud credentials, real provider requests, production writes or payments were
used. No production code change was required by these scenarios.

This is service-only evidence: no new native screen, physical-phone, notification,
unread-state or full-process-restart claim, screenshot or video is accepted. Native
multi-child and cross-team discovery remain to be replayed separately.
