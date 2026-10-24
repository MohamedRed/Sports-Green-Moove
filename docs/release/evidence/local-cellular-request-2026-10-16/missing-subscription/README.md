# Missing Default Data Subscription

Native [38891196698](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38891196698)
failed at `ec18e43e1e0ef0a550544485f43ba1251fedff33`, run
`3395ada5fef241985ec11d2176cde793`. These files are unmodified artifact copies.
Eight successful instrumentation transcripts account for 16 earlier cases.
The network case timed out during preparation, before radio changes or sends.

Both the initial and terminal preparation snapshots report SIM-ready state `5`,
data-disconnected state `0`, no valid default data subscription, Wi-Fi as the only
internet transport, airplane mode `0` and the observed always-on setting `1`.
The cellular request was registered, received no availability callback and was
released on failure. Run-bound modem receipts before and after report home
voice/data registration. Modem registration and SIM readiness alone therefore
do not establish a usable subscription or cellular internet route.

The accepted replay in the parent directory observed a valid default data
subscription, connected data and both transports. This contrast narrows the
missing precondition; it does not explain why subscription selection was absent,
prove deterministic device setup or establish a product send/retry defect.
No subscription setting, timeout, assertion or success receipt was changed here.

The two new confirmed-conversation process-restart stages followed the failed
network case in this version and were never reached. No restart receipt,
persisted export or final results file was produced. This failure cannot accept
restart, recovery, physical-device or release evidence. The subsequent runner
places network disruption last while retaining every required check.
