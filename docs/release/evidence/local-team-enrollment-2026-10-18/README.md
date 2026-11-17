# Isolated Team Enrollment

`services.json` is the original successful isolated transport report, run
`0dc3b6ab5dea0e6fafe540f4027e0ecb` at `2026-10-18T20:07:02.627Z`, from
`run-local-team-enrollment.mjs`, with 20 passing scenario groups. It fingerprints
the six-case domain test, five production modules, three replay modules and the
unchanged Firestore rules. No production data or provider requests were used.

## Verified

- Requests bind authenticated adult identity, viewed team/enrollment identity,
  safe revision and payload-bound operation UUID; they never self-approve.
- Only current managers in the team's stored club approve/refuse/revoke. Foreign,
  unscoped and admin-only claims do not grant approval. A child with both parent
  and manager claims plus a management membership is still denied. Role claims stay unchanged.
- Child requests require separately verified current parent authority and active
  child/parent club memberships. Link loss, revocation, missing/unknown/archived
  club status and team inactivity prevent grants. Public/private club states are
  checked against the app's existing model, not an invented active-club status.
- Stale decisions and competing approve/refuse transactions cannot both commit.
  Replaying an old approval does not revive a revoked enrollment. Reopening a
  closed request advances its revision; another payload cannot reuse its UUID.
- Server document creation metadata fences team and child deletion/recreation;
  editable creation fields cannot carry old approvals to a new identity. A team
  name edit preserves identity; transferring clubs invalidates the old view.
- Owned adult withdrawal works after membership loss. A co-parent with current
  verification can view an eligible child enrollment, but cannot withdraw the
  original requester's decision. Child approval withdrawal needs current authority.
- Direct REST access to enrollment/audit collections is denied for anonymous,
  parent, manager and admin clients. Malformed private records fail closed.
- Pages are bounded to 20 scanned rows with account/team-scoped cursors. The
  pagination scenario explicitly seeds 21 synthetic rows; they are not claimed
  as 21 successful user requests. Audit events contain no names/emails.

The first local replay exposed a cursor-error expectation mismatch; existing
scope-mismatch behavior was retained. A later replay caught the new code rejecting
the app's public club state; the implementation was corrected to the existing
public/private model, with missing/unknown/archived states still denied. Fresh
current-source passes, not those failed or superseded runs, back this report.

## Not Yet Verified

No native team request/review screen, group conversation, message exchange,
notification delivery, physical phone or deployed permission change is accepted.
The services do not yet feed team-chat authorization. Existing booking/ride chat
contracts remain separate. No infrastructure was changed; Terraform is not needed.
Backend CI and Web Integration Smoke replay the transport suite and validate the
retained scope. The overall release remains incomplete.
