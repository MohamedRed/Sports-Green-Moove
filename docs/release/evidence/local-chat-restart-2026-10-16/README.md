# Confirmed Conversation After Process Restart

Native [38893362199](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38893362199)
passed all enabled jobs at `9b62bb843becf37a8daeda4f1cb9c0fe1e371466`.
Unmodified artifacts record run `10da7e922d2622ecf5668869113a4e44`, tested
2026-10-16T11:33:33.498Z: 19 instrumentation cases and 20 coverage groups passed.
Four search cases use explicit fake component gateways, not provider matching.

## Verified

The parent sent one confirmed message through the app. An independent database
checkpoint retained its record ID, request UUID and original creation time.
The host verified the disposable device and same-run local app session, issued
force-stop only for `be.sportgreenmoove.app.local`, and confirmed process absence.
Instrumentation had already exited the prepared process (`observedBeforePid`
is null); this is not evidence of killing a still-running send or a crash.

The second stage ran in a different process (6454 before, 6571 after), opened the
signed-in home without login, restored the confirmed conversation and empty
composer, then sent another message. The driver signed in through the app and
replied; the parent signed in again and read that reply. Same-run receipts record
every stage. Independent final checks required exactly three intended messages,
three unique request UUIDs, one correctly addressed/read notification per message,
zero unread counts, and the original message identity/time unchanged. The
sanitized `local-chat-restart-persisted.json` was exported after these checks.

Original before/reopened/reply captures are retained. The reviewed reply image
shows all three messages, header, composer and navigation; only this new image
is added to the private portal. Older evidence and captures remain unchanged.

The mandatory network case ran last and passed its unchanged offline, cellular
handover, restored-send, reply, account-switch and persisted-record requirements.
Run-bound modem receipts again report home registration. Its initial preparation
already had both transports, a valid default data subscription and connected data.
This success does not resolve why the preceding run lacked a default subscription;
its original failed diagnostics remain in
`../local-cellular-request-2026-10-16/missing-subscription/`.
Final results were written only after verification and cleanup succeeded.

## Still Open

This verifies confirmed messages and persisted login after an explicit app stop.
It does not test pending sends or unsent drafts across force-stop, token expiry,
post-commit acknowledgement loss, physical phones, push delivery or journey
tracking after restart. The agreed team audience includes members of one team
and authorized parents of enrolled children, but group conversations are not
implemented. The older SlotWriter crash remains unexplained. The app and rules
are not deployed to production, and release manifests remain unchanged.
