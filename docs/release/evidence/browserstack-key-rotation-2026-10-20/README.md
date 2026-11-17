# BrowserStack credential rotation, 20 October 2026

Explicitly authorized by the user. The one-shot maintenance run
[39518256734](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39518256734)
completed successfully from `dc7ad04b639c1fe87b1514dc79b86f436cdfd063`.
Only its credential-maintenance job ran; app distribution was skipped.

The provider accepted the new key (HTTP 200) and rejected the old key (HTTP 401)
against the read-only recent-apps endpoint. The encrypted handoff was decrypted
only in the original local process, after matching its request, repository, run
and source identities. `gh secret set` received the new value through standard
input. The inventory confirmed the secret update at 23:57:45 UTC. A separate
local request using the new key returned HTTP 200. The repository secret cannot
be read back; its inventory timestamp is not a claim of a subsequent device run.

`receipt.json` combines the sanitized runner receipt with these local completion
observations. No credential values or recipient private key are retained here.
The encrypted artifact has one-day retention, and the local process discarded
its private key after successful secret update and final authentication.

No device session, app upload, customer account, booking, payment or map request
was created by this operation. It does not accept any user-flow, physical-device,
tracking, safety-audit or store-review requirement. Shared staging billing remains
unresolved. Earlier isolated phone evidence remains dated to its actual trial:
[18 October booking](../browserstack-isolated-booking-2026-10-18/README.md).

This replaces the credential-rotation prerequisite, not the separate backend and
isolated-device readiness requirements. Resume trials with isolated test data;
do not assert that production distribution has been approved.
