# Trip Change History

The Android trip card and each signed-in parent's reservation expose a paginated
history entry independently of `pendingChangeId` or `appliedChangeId`. Declines
and withdrawals clear active references but do not delete the saved proposal.

`getTripChangeHistory` is authenticated and bound to a trip. The query returns
only the caller's driver/affected-parent records, in descending stored creation
time and document-ID order, with a fixed ten-item page. Cursors retain the
timestamp's fractional field and bind both user and trip. Supplied roles, owners,
participants and page sizes are rejected.

Every returned record is validated by the existing proposal identity, current
booking ownership and guardian checks. Historical lists fail explicitly if
authority cannot be verified; an error is not an empty or partial success. Child
guardian revocation applies to listing as well as direct review. A parent added
after a proposal cannot see that earlier proposal. The list DTO contains only
proposal identity, status, creation/departure dates and proposed price: no other
parent's booking IDs, decisions or request identities.

Opening an entry reuses the authoritative review endpoint. Closed proposals do
not regain accept, decline, withdraw, route, application or proposal controls.
Current open proposals retain their existing checks. Reads do not write a
decision, notice, booking, quote or payment. Cancellation does not erase an
otherwise authorized parent's history.

The Android history controller clears stale data on errors, closes on account,
role or trip scope changes, ignores late responses and pages only after an
explicit action. Refresh restarts from the first page; repeated/cross-trip rows
and non-advancing cursors are errors, not silently deduplicated.

The new indexes are codified in `firestore.indexes.json`, the repository's
existing Firebase index deployment artifact. No production index, Functions or
app deployment was performed, and no paid resource or separate Terraform-managed
infrastructure was introduced.

See [18 October evidence](../release/evidence/local-trip-history-2026-10-18/README.md)
for passing isolated service/unit checks and the completed 32-group native history UI
checks. The prior interrupted native run did not exercise this feature.
