# Connected Local Child Signup, 26 October 2026

This is a separate, stronger browser trial after the earlier fake-handler visual
review. It does not rewrite that earlier record or promote the phone journey.

The actual public application entry, invitation component and named Firebase
client gateway ran against the isolated `demo-sgm-local-qa` services. The normal
entry supplied no submit-handler override. No application or backend was deployed.
The existing primary invitation URL was not opened against production: a
loopback-only QA entry redirected its isolated token into the local public route.
That entry is test scaffolding, not a product fallback or a published endpoint.

## Observed

- The real component rendered at 390 px inside a local frame. The actual submit
  took place in the top-level desktop page, not in that frame or on a phone.
- Mismatched confirmation displayed its French error. An independent service
  observation found three original users, zero redemption requests and no link.
- With matching confirmation, the real form displayed disabled fields and
  `Creation...`, then `Compte cree` with the separate parental agreement reminder.
- The service observation found exactly one new enabled child account, only child
  claims, a matching server-owned profile and accepted invitation, one redemption
  request and zero parent-approved links. Original account claims were unchanged.
- Reloading the token-cleared address displayed `Invitation indisponible`, without
  an account form. The app deep link was not opened on this computer.
- The initial native typing attempt detached after its first character. A later
  native accessibility click was stale. Those automation failures were inspected;
  actual fields were filled with browser locators and clicked from a fresh image.
  Neither failed automation command is counted as an application defect or pass.
- The owned runtime exited, its directory was destroyed and all five endpoints
  were confirmed closed. No production fixtures or provider requests were used.

`observations.json` and `disposal.json` are original runtime-generated receipts.
`browser-review.json` is the explicit manual browser review, not an automated
video, a screenshot file, or proof of phone execution. Source bytes are retained
by hash. The app source was `f773b3d`; the new QA runtime is bound by source hashes.

## Still Open

Native sharing, an actual phone-browser signup and app-link handoff, child sign-in
and separate parent approval on phones, iOS and physical trip evidence remain open.
No new gallery media or release acceptance is claimed.
