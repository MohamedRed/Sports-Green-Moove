# Team Enrollment After Club Recreation

Local authenticated service trials on 2026-10-19, using a disposable
`demo-sgm-local-qa` environment and fictional accounts only. No production
deployment, real account, payment, provider call, native or physical-device test
is accepted by this evidence.

## Original Failure

The application started from `23e056b8cfb9642ae389587951345289d088ed5c`.
The new regression harness was initially uncommitted; the reports bind its exact
bytes and the actual application source by hashes retained in `source-archive/`.
These are local trials, not GitHub Actions executions at that base commit.

`before/attempt.json` preserves all eight original groups: three passed and five
failed. After deleting and recreating the selected club, the actual responses
still reported the old adult enrollment eligible, the old parent verification
accepted for a current team, and the old team offered as a choice. Expected
denials of manager access/decisions also failed. The original failure is not
rewritten as a pass. Baseline records and account claims remained unchanged; the
separate disposal receipt confirms that the owned runtime was removed and all
four ports closed.

`setup-not-executed/` retains an earlier Java-version prerequisite failure. No
application case ran then. The actual trials used the already installed JDK 21;
no software, billing or shared infrastructure was created.

## Root Correction

The server had checked team IDs and current club status but had not compared the
team's actual server creation timestamp to the club's current server creation
timestamp. Child eligibility had compared the guardian decision to the child's
creation, but not the club's creation. The correction uses server metadata, not
editable `createdAt` data. It is applied to eligibility, every manager decision,
team choices, child choices and manager review/roster paths. Orphaned teams cannot
grant new access; owned historical requests are not deleted or turned into new
approval. Team-choice/review cursors are also bound to the club generation.

The correction does not migrate club membership records, grant roles, implement
team conversations or decide their history/child-account policy. Existing trusted
membership fixtures are deliberately preserved to isolate the team/guardian
generation checks. Fresh current-team approval still requires a new manager
verification of the parent relationship.

## Verified Result

`initial-fix/` preserves the first eight-case passing trial separately; it did not
yet test cross-generation pagination. `passed/results.json` records the final ten
passing groups, including both cursor cases, unchanged valid identities after
editable-date changes, denied orphaned-team access, and successful fresh explicit
parent verification plus current-team approval. Fourteen protected collections
and other live rides are checked; only the named club, new team and selected
guardian-verification fixture are excluded as intentional scenario mutations.
Account claims are unchanged. The administrative client closes, the owned runtime
is destroyed and four closed ports are verified before the positive report.

The unchanged existing enrollment and choice suites also pass: 20 and 12 groups,
respectively, with their original coverage limits. The backend unit suite records
364 passing tests. Their reports/transcripts and declared source are retained.
The file manifest binds original attempt reports, logs and disposal receipts.

The portal may report these ten service checks while keeping prior phone captures
on their original scope/date. The new rejection paths have not been replayed in
the native UI or on a phone. Team messaging, safety-audit acceptance and all
physical tracking requirements remain open. The backend correction is not live.
