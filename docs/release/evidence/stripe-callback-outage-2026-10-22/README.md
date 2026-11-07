# Production Callback Availability Regression

22 October 2026. Source: `a6d8a6304ef8c104fa72172263a1804280227a08`.

The production provider gate failed at 21:32 UTC with
`SGM_STRIPE_CONNECT_RETURN_URL callback returned HTTP 500`:
[original failed step](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39857993823/job/120101089787).

Two subsequent independent public health requests at 21:55 UTC reproduced HTTP
500 for return and refresh. `health.json` retains the selected, sanitized response
metadata observed through the unchanged `checkConnectCallback` implementation.
Each URL was requested once in this recheck, with a 15-second timeout. No request
carried credentials or onboarding state. Response bodies, cookies, trace IDs and
account identifiers are not retained.

The required contract is HTTP 204 with the corresponding
`X-SGM-Stripe-Callback` marker. Neither response carried that marker. The earlier
11 October deployment remains historical evidence, not proof of current
availability. The manifest now records `verification-failed`; the release gap
report must list `stripeConnect` until a later observed recovery supersedes this
failure. The live provider gate is not weakened or retried.

## Diagnostic Limits

Read-only metadata still reports both Functions ACTIVE and both Cloud Run
revisions Ready. The bound secret version is enabled; the runtime identities
exist and retain secret-access grants. Those configuration observations do not
establish that an instance can currently start. Direct service health requests
also failed; no application callback marker was received.

Production billing linkage reports `billingEnabled: true`. The signed-in owner
console identifies Firebase Payment as the linked account. The separate suspended
account reached from the global warning has a different account identifier,
verified by an in-memory hash comparison. It is not evidence that this production
account is suspended. ADC's unrelated quota project was also excluded from the
production diagnosis. No billing/account identifiers or raw metadata are shared.

The cause remains unconfirmed. No project, billing account, quota, IAM policy,
secret, deployment or provider setting was changed. No replacement resource was
created, no payment was attempted, and no customer record was written. Restoring
the health contract alone will not prove real driver onboarding, payments,
refunds, payouts or physical-device recovery.

The partner portal records the blocker locally. Publication remains on hold
while its audience is public. The separately authorized Site token rotation
completed and readback confirmed the same access policy; that does not make the
Site private or authorize publication of private evidence.
