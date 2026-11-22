# Local Conversation Directory Checks

Date: 2026-10-15. `results.json` is the unchanged sanitized output of the isolated
local suite executed with the code in this commit. Thirteen scoped groups passed;
this is service verification, not thirteen phone-screen cases. Older 12-group
delivery evidence remains unchanged in its own directory.
`timestamp-fixtures-results.json` preserves the earlier 13-group run before the
published-trip regression case was added; it does not prove that new case.
`published-date-results.json` retains the next passing run; the current result
also verifies the shared Firestore-only initialization used by preparation tools.

The new directory group seeds 25 historical sources and one empty reservation
for separate synthetic adults. It explicitly prepares each private history index,
proves dry-run creates nothing and requires unprepared history to fail closed.
Reservation listing traverses 20 + 6 rows without duplicates; selecting an empty
reservation creates no message. A real callable send then starts that thread.

One thread receives 120 real local callable sends. The old latest-50 message
preview returns only that thread; the directory still finds all 26 sources.
Changing the page-boundary conversation after page one does not change the six
sources returned by the issued cursor. Reading the newest 50 leaves 70 older
unread; repeating acknowledgement does not change revision. An outgoing reply
does not erase incoming unread counts.

Unauthenticated access, another account's cursor, a cursor for the wrong list,
malformed/oversized cursors and canonical-parent override attempts are rejected.
Counter underflow cannot partially mark a message read. Corrupt summary schema
blocks sends, a mismatched existing index is not overwritten by preparation, and
history without a timestamp cannot be skipped into a new summary.

A separate actual local `createTrip` / request / approval sequence also starts a
new conversation. Its ISO departure date, written by publication, is accepted
alongside the timestamp representation used by historical fixtures. Both picker
and conversation directory return the same actual date, with no invented value.

These are disposable local records, with external provider requests blocked.
This report does not establish app UI, push, real payments, physical tracking,
production deployment or completion of the release manifest. The separate native
app scenario must pass before its screenshots/results can be accepted.
