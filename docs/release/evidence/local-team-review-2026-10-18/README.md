# Club Manager Team Review, 18 October 2026

`results.json` retains eight actual authenticated service groups and ten actual
management-browser groups against `demo-sgm-local-qa`. The original report and ten
unedited 1100px-high browser PNGs are bound by `artifact-sha256.json`; 30 source
fingerprints bind the tested implementation and isolated configuration. No password,
session file, token, live provider request or production write is retained.

## Observed Scope

The existing QA manager signs in through the real management login. It can select
its club, continue through 25 team choices, select the target team on the second
page, and continue through 25 distinct enrollment requests. The new manager-only
team directory also retains closed teams for removal/review, while parent choices
still exclude closed teams. Every page rechecks current canonical club authority;
cursors cannot cross clubs or list kinds. No team/member role is granted by reading.

The browser cancels an approval without an event, refuses the parent request,
observes a new request, then submits approval with its reply deliberately dropped
after the real operation commits. The screen clears stale actions; one explicit
refresh finds the actual approved record without a second decision or event. A
parent withdrawal appears without another available manager action.

The manager confirms a verified child's enrollment. After guardian verification is
revoked through a separate authenticated SDK operation, a fresh read hides the
child's name, and the manager confirms removal. Revoking the manager's canonical
membership makes the next read clear both private rows and saved team choices
immediately. Signing out and signing in as the parent cannot retain the manager
screen. Browser requests and the persisted records were checked independently.

There are 26 authenticated SDK request operations: 23 other parents, the main
parent and child, plus the parent's new request after refusal. The core pair has
eight exact transitions and the other 23 requests remain at revision one; all 31
team-event actors/revisions and three guardian transitions are checked. All
original records and account-role claims are restored by scoped cleanup. The
existing QA manager has club-manager and parent claims, not an administrator claim.

## Captures And Limits

Layouts were checked at 1440, 768, 390 and 320px. The base font was independently
measured at 1.3 times its original size for the later mobile checks. The reviewed
desktop list, confirmation, recovered approval, child approval/removal and denied
access captures are allowlisted for the private progress site. Scrolling to the
actual target preserves the original browser image; no app content is edited.

Manager decisions use the real browser UI and SDK gateway. Parent requests,
withdrawal and guardian revocation use separately authenticated SDK calls, not
parent screens. Manager-membership revocation is isolated fixture control, not a
membership-management UI action. This is not a two-screen end-to-end parent/manager
replay, a physical phone, native app, full-process restart, push-delivery, team-chat,
payment or tracking proof. There is no new video or production deployment. The
release manifest and the overall user-flow goal remain open.
