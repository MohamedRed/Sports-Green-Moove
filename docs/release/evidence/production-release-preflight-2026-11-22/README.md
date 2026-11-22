# Production backend preflight, 22 November 2026

Read-only Google Cloud and Firebase metadata checks compare production project
`sports-green-moove-prod` with source commit
`46f7ee14e8bc111526edf4f5bdac8f42408919f4`. The Functions TypeScript build passes.
No Secret Manager value or customer record was requested. Function descriptors
were filtered in memory; environment values are excluded from retained evidence.
No cloud resource, account, notification, payment or deployment was created.
No Terraform plan/apply ran.

## Configuration comparison

| Component | Deployed state | Candidate / result |
| --- | --- | --- |
| Functions | 31 active HTTP functions, Node.js 22, `us-central1` | 101 named exports; 70 missing, no deployed-only names |
| Firestore composite indexes | 10, all `READY` | 36 definitions; 26 missing, no deployed-only definitions |
| Firestore rules | Last release update 14 June 2026 | Different; reviewed delta retained |
| Realtime Database rules | Active existing `europe-west1` instance | JSON matches the candidate |
| Storage rules | Existing default Firebase bucket | Exact source SHA-256 matches the candidate |
| Urgent-support email secret resources | Neither exists | `SUPPORT_EMAIL_API_KEY`, `SUPPORT_EMAIL_CONFIG` required |

Missing functions include `listReservations`, `getEmergencyContact`,
`reviewClubMembership`, `markNotificationRead`, team conversation/push operations,
child invitations and urgent-support dispatch. `function-comparison.json` lists
all 70 names. Counts describe exported services, not 70 independently verified
user flows. Existing function names alone do not prove implementation equivalence.

`index-comparison.json` retains the 26 missing definitions. Field order,
direction and collection scope were compared. The implicit document-name suffix
is omitted on both sides; the candidate's explicit document-name ordering is
identical to its preceding descending field. The original remote definitions
remain in `firestore-indexes.json`.

The reviewed Firestore delta tightens manager membership checks, makes membership
and notification mutations server-owned, restricts direct trip edits to titles,
checks current booking/ride authority when reading chat, restricts rating reads
to their author, and denies direct access to child-link, emergency-contact and
team push records. It also adds the server-owned chat inbox and urgent outbox
rules. This is a behavior change requiring a reviewed production rules release;
it is not a whitespace-only update. No unexplained production-only policy was
found in the retained delta.

## Release preparation

[The release review](RELEASE-REVIEW.md) separates observed configuration from
the owner decisions and deployment work still required. In particular, the
current `createTrip` callable checks driver role and verified profile but does
not enforce membership in the requested club/team. Its authorization policy
must be resolved before approving that candidate for production.

The existing rules Terraform configuration remains the proposed rules writer.
The required owner-controlled state backend is not selected. Provider/sender
setup and secret versions are also pending. This snapshot is not deployment
approval, a Terraform plan, a rollback rehearsal or a successful phone trial.

The metadata queries are independent observations, not an atomic snapshot.
`review-scope.json` records capture times and exclusions. `sha256.json` binds the
retained files. Rules source contains policy code, not application records.

The full release evidence gate remains incomplete: production tracking on both
platforms, emergency dialer handoff, operational notifications/access revocation
and six safety-audit exports remain unaccepted. Local builds, focused Android
checks and this preflight do not replace those requirements.
