# Isolated Team Device Registration

1 November 2026. Sixteen real callable checkpoints pass against a disposable
local Auth/Firestore/Functions setup with synthetic device tokens. All original
top-level records, roles and disabled-account states remain unchanged. The build
passes 565 unit cases, including 15 registration-domain cases; twenty database
rule/notification-acknowledgement cases also pass, including server-only access
to registration and token-index documents.

Registration, concurrent replay, token rotation, competing revisions, proof-bound
account transfer, sign-out removal, tombstone replay, multiple devices, limits,
child/disabled exclusions and corrupt metadata are covered. Replies never return
the token or installation proof. Source hashes are compared before build and
after execution; selected source bytes and original reports are retained.

The first expanded trial fails because its assertion expected the entire token
collection to be empty after removing one device, despite another device being
intentionally registered by the new race case. Its original negative log remains
in `failed-fixture-trial.txt`, without source attestation or acceptance. The
corrected assertion checks the exact unchanged unrelated device set. This is a
test-fixture correction, not evidence of a product defect or repaired delivery.

This proves only the server registration prerequisite. Native lifecycle/token
calls and the dispatcher are not implemented by this result. No real phone token,
provider send, background receipt, tap, iOS, production deployment, physical GPS
or release acceptance is claimed. Existing in-app phone evidence is separate.
The source archive is not a complete-head attestation. Public publication is
limited to one short local-result note; no new screenshot or diagnostic is public.

The isolated runtime is destroyed, its four ports are independently closed, and
both database/admin clients terminate. No paid infrastructure, provider calls,
customer records or real payments are used. Screenshots remain enabled on Android
12 and earlier per the owner's explicit 1 November decision; no older-device
physical verification is inferred.

The later current-account recheck exposes a missing stale-login case and extends
the common team guard. This original 16-case result is historical, not proof of
that later correction. See `../team-push-registration-recheck-2026-11-01/README.md`.
