# Credential Replacement Before Phone Replay

During preparation of a new isolated phone trial, the local control page briefly
returned an unmasked access-key input in a diagnostic result. Treat that key as
compromised. It was replaced once by the existing encrypted-handoff maintenance
workflow, run `39639558489`, request `27f7d88f-3f1d-4da6-a345-319d40ca5a04`,
from `70daee2173b5d75815d657dd4c4b847682aa67d7`.

The maintenance receipt verifies the replacement key with HTTP 200 and rejection
of the exposed key with HTTP 401. The recipient matched request, repository,
run and source identity before decrypting. The replacement was delivered to
`gh secret set BROWSERSTACK_ACCESS_KEY` through stdin; the inventory confirms
its update at 17:00:06 UTC. An independent authenticated read returned 200.
The recipient private key was removed. No plaintext credential, recipient key
or credential-bearing UI diagnostic is retained in this directory.

The isolated backend had reached readiness and the loopback-only APK compiled,
but no new App Live device was started and no new app-flow result or capture
is accepted. The helper's initial connection was stopped, all processes owned
by the preparation were terminated, the service supervisor exited after SIGINT,
and the private session file and listener ports were independently checked.
These observations are in `cleanup.json`. Existing completed flow evidence
keeps its original scope and date.

This operation neither starts a device nor uploads an app, changes a subscription,
uses production customer accounts, exercises a payment or consumes map requests. The encrypted
handoff remains recovery ciphertext with one-day remote retention; it is not
committed here. This record does not accept release, tracking, notification,
physical restart, safety-audit or store-review requirements.
