# Complete Local Native Run At 67ab59c

Native run 39313165963 succeeded on 19 October 2026 at
67ab59ca132db1754b3236f97284ce48d5bc022f. Its original artifact is
12217997642 (`android-connected-ui-test-results`). This is the actual app on a
disposable Android emulator with isolated data, not a physical phone or a release.

The original JUnit contains 159 records: 120 executed passes and 39 explicit
skips, without failures or errors. The separately authenticated replay retains
all 36 existing groups and 38 native cases across 30 transcripts. Three additional
independent trials pass: parent observation, native tracking startup and remote
completion while the driver app is backgrounded. These are three more cases,
not three newly completed production journeys. The suite receipts and original
primary-transfer records are retained without accepting cleanup-time exports.

The network replay now includes the measured initial observation before either
transport request. Its six recording/precondition cases and two initial-network
cases execute in the ordinary suite. Actual Wi-Fi/cellular handover, full local
disconnection, retained draft, retry, peer reply and read state pass. The two
temporary transport requests are released. This closes the execution-evidence
gap left by the earlier matrix's absent initial-observation record; it does not
explain the original failed modem state or establish physical-network reliability.

The final device receipt verifies the installation guard, unchanged maps runtime,
enabled location, restored original settings, removal of test-only administration
and removal of its helper. This proves cleanup for this run, not general device
stability. The earlier preparation failures remain under `ci-df9e245-2026-10-19`
and `local-ui-shell-shutdown-2026-10-19`. No assertion or former failure is replaced.

All selected original JSON, transcripts and PNGs are retained. The parent fresh
position and driver startup screenshots were visually reviewed. They show
"CARTE INDISPONIBLE": this run did not render the SDK map or prove marker movement.
Other retained captures are raw supporting artifacts, not newly reviewed portal
media. Source archives bind all 108 declared source files to this run's Git commit.
The portal keeps the previously reviewed tours and their individual scopes.

Web run 39315344337 is a separate successful check at 93d1c3d33c11595a43342e884235ddfffd22a007.
Its isolated-session shutdown step passes after the shell-exec change. This is
not a claim that every check at 67ab59c was green: that head's web shutdown failed.

The newly prepared, manually gated vehicle-map trial was not part of this run.
It uses the protected build credential without sharing it with the service test
runtime. Physical tracking, ETA, child positions, child-own emergency access,
team chat, live payments/refunds, store emergency action and real safety-audit
exports remain open. Production has not been deployed and no release manifest
item is accepted by this report.
