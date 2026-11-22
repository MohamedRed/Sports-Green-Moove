# iPhone Profile City: Local Checks

Checked 5 November 2026. The profile previously sent "Ma ville" to Options,
without an editor. The candidate replaces that route with an account-owned city
entry and a separate editor. The other settings/actions are preserved in a
short extracted settings component. There is no search or trip default change.

The actual gateway calls the existing getProfileCity/saveProfileCity endpoints.
Only the server selects the account. Write payloads bind a nullable canonical
city, the displayed revision and a stable UUID. Text validation matches the
server's 100-UTF16-unit bound, unsafe character rejection, trimming and NFC
normalization. Persisted responses require exact keys, owner, safe integer
revision and canonical UTF16 bytes; Swift's canonically-equivalent string equality
alone is not sufficient. Missing cities remain null, not a guessed place.

The editor does not optimistically change the saved city. It accepts only a
validated owner/city/exact-next-revision receipt. An unconfirmed write retains
its immutable intent and retries only the same UUID, revision and city. A failed
fresh read cannot discard that intent; a successful explicit read resolves it.
Removal retains the server tombstone revision. Fields cannot replace a pending
intent. Dirty close/refresh needs confirmation. The profile row rereads after
editor dismissal rather than treating local text as persisted state.

Actual account-work leases last until callbacks settle. Sign-out, same/different
account replacement, role changes, view closure, background and cancellation
cannot restore old city data, pending intents or feedback, overlap earlier work
or release its lease prematurely. Data is scrubbed on invalidation. No automatic
retry, cache/volatile fallback, account choice or role grant is introduced.

Controlled native checks pass for three persisted states, nineteen malformed or
foreign records, nine unsafe inputs, three malformed envelopes, four invalid
write groups, exact payloads and 32 delayed read/save success/error boundaries.
The real gateway and DEBUG-only synthetic fixture adapter pass controlled
signature checks. SwiftUI syntax parses. These are not real SDK/UI acceptance.

The unchanged separate city backend suite passes all ten groups: authentication,
strict input/ownership, normalized save/read and account isolation, idempotent
lost-response replay, concurrent single-winner edits, removal/stale retry denial,
malformed storage denial, direct access rules, profile initialization and
preservation of unrelated trips/bookings/roles/claims. Its original receipt and
source hashes are retained. Both clients close; a separate observation verifies
the runner removed its owned disposable environment and all four endpoints are
closed. This does not connect the new native UI to that backend.

Save, reopen/readback and deletion assertions are prepared after the existing
profile capture, inside the original profile case. All eleven UI cases, the
50-minute standard-public-runner gate and optional three-image/under-2-MB/one-day
capture bounds remain unchanged. No new native media, capture, phone session,
production write, provider request or payment occurred. Native layout,
accessibility, actual SDK/UI, service integration and release remain unverified.
Both iPhone automated manifest entries stay pending. The earlier eef1c4c gate
continues separately and cannot execute these newer city changes.

The portal adds one concise local-only city note and preserves every earlier
flow, date, status, image, video, tour, blocker, update and public access. Earlier
club/SDK/UI evidence remains immutable. No infrastructure change needs Terraform.
`summary.json` separates proof layers; `source-sha256.json` freezes the exact
candidate sources and earlier profile route in the content-addressed archive.
