# Approved Private Invitation Trial

Before any further manual trial, follow `private-phone-input.md`. The approved
parent-approval retry at 5d34c0f was stopped before signup after a temporary
credential reached the wrong input surface. Its dataset and connection were
destroyed. It is not a failed application signup or completed parent approval;
the earlier successful signup remains separate, source-bound evidence.

The user approved a fresh private child-signup trial on 2 November 2026, after the
earlier alias-only phone trial reached the form but never recorded a redemption.
Use `start-child-invitation-browser.mjs <output> <private-session> --same-origin-approved`
only for this approved trial. It implies the existing private alias scope; no new
port, public site, host routing or browser protection change is introduced.

The named, in-memory invitation client explicitly uses the page's private origin
for its signup callable. The mode refuses production builds, live projects,
disabled emulators, unexpected origins or malformed flags before creating its
signup gateway. It does not change the global admin clients or the ordinary
emulator defaults, and never retries through another address on failure.

The temporary server forwards only one anonymous POST path:
`/demo-sgm-local-qa/us-central1/redeemChildInvitation`, to loopback port 5001.
Host and Origin must agree on an allowlisted private port-4185 origin. Authenticated
headers, cookies, other callables/projects, auth HTTP requests, redirects,
non-JSON replies and oversized bodies are rejected. No request content is logged.
The public signup implementation and real account creation remain untouched.

Run the connected browser preflight with a separate disposable local dataset.
Its actual React form rejects one mismatch, submits once through the real SDK,
and verifies the child-only account in independent records. It neither injects a
submit handler nor accepts native sharing, a phone signup or parent approval.
Dispose of that entire local dataset before starting a fresh phone trial.

For the phone trial, keep the existing four service ports plus approved private
port 4185 only. Retain independent before/mismatch/created records, reviewed masked
session crops and actual disposal evidence. Creation remains separate from the
verified parent's approval of the child-profile link. Never publish credentials,
raw responses, invitation fragments or an unverified success.
