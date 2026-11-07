# Isolated Network Recovery Recheck, 28 October

Source: `7417e22703e3b89d69850248380c3223b98e1700`, native run
[40754791471](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/40754791471),
completed job `123050720893`, artifact `12844624835`.

One unchanged native scenario passes: Wi-Fi default with both requested networks,
exclusive cellular handover, both radios offline and backend unreachable, retained
unconfirmed draft, explicit successful retry, cross-account draft isolation and
the other account's reply. Independent stored-state checks find two messages,
two notifications and no duplicate messages. The primary evidence copy passes;
the owned environment is disposed and the independent device/policy restoration
passes. Original receipts, instrumentation, job/artifact metadata and source
hashes are retained and validated by `chat-network-recheck-evidence.mjs`.

This is a simulated device with isolated services, not a physical-phone network
or GPS test. The cut occurs before the first send, not after a server commit.
No process restart, token expiry, real push, real payment or release acceptance
is proven. No new images or video are published; existing captures keep their
original dates.

The previous `a4995ce` preparation failure remains unchanged in the dependency
evidence bundle. This successful job predates the `9da2228` read-only capability
observer and cannot be attributed to it or to a proven network-selection repair.
The full native matrix has its own outcome; this one job cannot pass it.
