# Complete Owned Ledger Summaries

`getImpactSummary` and `getRewardSummary` require authentication and an empty
request. The server selects the caller's UID; owner IDs, cursors, limits and other
fields are rejected. No ledger, account, role or payment is written.

Each endpoint traverses the entire owned collection, in document-ID pages of
200, inside one read-only transaction snapshot. Only one page and bounded output
state are retained in memory. The page size is not a total limit. Reads are O(N)
in owned ledger rows; this is not a materialized projection or an aggregation
index. A service deadline or read error fails the request, never returning a
partial total. Evaluate projection/backfill design before high-volume rollout;
do not silently cap history to reduce cost.

The impact response includes `userId`, `totalCo2Kg`, `sharedDistanceKm`,
`rideCount` and at most six `{month, co2SavedKg}` entries. The complete meter sum
is converted to whole kilometers only once. Months are the latest six occupied
months in Europe/Brussels, ascending, preserving the previous occupied-month
semantics rather than fabricating empty periods.

The reward response includes `userId`, complete posted `balanceCents` and at most
eight `{id, type, amountCents, createdAtMillis}` entries. ISO timestamps and native
timestamps are normalized before chronological sorting; ID breaks ties. The
posted balance includes debits and refunds. It is not an available-to-withdraw
balance and does not replace payout reservation/authority checks. Cents use exact
integer accumulation and must fit the current native signed 32-bit model.

Missing or malformed money, currency, dates, impact or distance fails closed.
There is no inferred zero or conversion from undocumented legacy fields. The
isolated historical seed was corrected to canonical meters, EUR and a supported
reward type; this is not a production data migration.

Both apps replace their capped ledger queries with these endpoints and fence
responses against account changes. Numeric/money validation rejects malformed
payloads rather than truncating them. A genuinely empty ledger returns explicit
zero totals. Deploy the server endpoints before distributing the updated apps.
No infrastructure, provider credentials, billing or index change is required.
