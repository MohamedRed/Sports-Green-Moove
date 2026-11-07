# Booking And Ride Chat Access, 5 November 2026

Local security correction only. No production apply, real account, payment,
provider request, phone session or new media. iPhone booking/ride conversations
still need implementation and complete native verification on both platforms.

## Reproduction And Root Cause

The original message rule trusts historical `participantUserIds`. Seven genuine
isolated send/get/query scenarios reproduce a removed participant reading old
messages directly, although the current-source callable denies access. The eighth
control is a cancelled booking with unchanged participants; its history stays
accessible. Twenty-two protected records and all test account claims remain intact.

The first candidate correctly blocks revoked direct reads but also rejects valid
bounded history queries. A separate eight-variant SDK diagnostic isolates the
redundant static `participantUserIds is list` predicate. Removing that predicate
does not remove `hasAny`, current-source authority or historical addressing. A
field-access-only change did not fix query compatibility; its failure is retained.

Fresh reads alone do not clear an already displayed conversation. The original
active-message-listener expectation fails: 218 of 219 rule cases pass, but that
listener does not terminate solely because a dependent source changes. The exact
failed test is frozen as
`../source-archive/f1941203ccf763f4eeb6456129b0f7ef75192538fa54e21440b5355600078ef5.txt`.
Do not treat a later passing source-observer test as proof that this original
message-only expectation now works.

## Candidate

Message GET and actual bounded query require both historical addressing and
current booking/ride participation. Parent takes precedence over requester;
requester is used only for an absent/null parent. Booking source reads use the
same participant rule so legitimate requester-only conversations can be observed.
Existing booking admin access remains; no admin bypass is added to message reads.
Current-source deletion, driver/member/child removal and malformed ride arrays
deny access. Cancellation alone does not remove participants or erase history.

Android observes the source and authenticated identity independently of messages.
Only a server-confirmed source without pending writes can start the message
listener. Source denial, deletion, membership loss or identity change closes the
stream. Owned source, message and identity listeners are disposed. Conversation
state clears private messages, names, pagination and read feedback on failure or
lifecycle cancellation. Generation checks discard delayed paging/read callbacks.
Existing private unsent drafts are not deleted by this correction.

The replacement SDK regression observes source change/permission denial alongside
the open query. Six Kotlin policy/flow cases and four state cases exercise the
actual application guard and late callback cleanup. These are not phone UI proof.
Offline clients cannot learn an unreceived server revocation; physical network
loss/reconnect and complete current-account/native integration remain unaccepted.

## Results

- Final isolated callable/direct-read/query suite: 9/9, including protected data.
- Complete original ten rule suites plus new suite: 219/219; zero skips.
- Complete Android JVM unit suite: 840/840; zero failures, errors or skips.
- Terraform initialization, validation and formatting: local pass only.
- All owned local runtimes destroyed and their endpoints confirmed closed.

Original failed candidates, the failed message-only listener, the source-listener
denial, a runner argument failure's cleanup receipt, and final results are retained
separately. `summary.json` binds original results and unit XML checksums;
`source-sha256.json` binds tested source bytes, including failed candidates.

`infra/firestore-rules` models an explicitly selected existing rules release,
preserves old remote rulesets and prevents release deletion. No project, billing,
budget, API or storage is created. No production plan/import/apply was performed.
An owner-approved drift review/state setup, deployed policy SHA verification and
native revocation evidence remain mandatory. The release manifest records the
new operational requirement as pending, not accepted by local tests or CI.

The public site adds one short local-only note. All prior flow records, statuses,
dates, tours, galleries, blockers and updates stay unchanged.
