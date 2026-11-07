# Live Observation Diagnostics, 25 October 2026

This is a separate, incomplete physical Pixel 9 Pro / Android 15 investigation.
It does not replace the earlier seven-checkpoint network run or its three public
screenshots. The new opt-in diagnostic build is based on 566a994 plus the archived
uncommitted source. Only isolated debug builds can log enum events, local sequence
numbers, monotonic elapsed time and connection booleans. No request bodies,
coordinates, account identifiers, credentials or SDK-wide debug logging enter
that diagnostic channel. Release tracing remains disabled. No polling or refresh
fallback was added and no production app or backend was deployed.

## Phone Evidence

The first fresh disposable session loses the diagnostic panel after collapsing
it. Its observer completes only preparation and the first simulated position.
It is stopped as incomplete. The app is signed out, uninstall is acknowledged,
and the session and owned local backend are disposed of. Only the idle testing
page is reloaded; Chrome is not restarted.

The second fresh session keeps the diagnostic panel open. The overlapping original
event views collectively contain all 14 events of observer 1 and all six events
of observer 2. Both show `.info/connected=false`, never true. Neither receives a
location invalidation. All four refresh requests complete in under one second.
The first listener lasts 470107 ms; returning from system Home opens the second,
which lasts 135537 ms. The loopback server is receiving native driver uploads,
including the changed made-up point. This narrows the failure to establishing
the live connection in this isolated setup; it does not establish the transport
root cause or a production subscription/UI defect.

The log viewer was initially scrolled to older rows. Later overlapping views,
including “Scroll to Latest”, recover the complete sequences. The attempted log
download times out and supplies no artifact; the retained views are selected
original diagnostic rows, not a downloaded full log.

The second ordered network observer is also incomplete: after its third accepted
checkpoint, its offline-stability comparison reports a newer upload than the
boundary sample. Do not treat the offline interval or whole UI recovery as passed.
The output report, its three checkpoints and original baseline remain unchanged.
The later supplemental read-only observer confirms point B, full unrelated-record
and claim isolation, and a fresh measured 50-second stability window after UI
sign-out. Those samples do not repair the failed ordered run. Two setup errors
in that supplemental observer occur before a sample is saved: missing cleanup
options, then SDK Timestamp versus JSON prototypes. The final observer compares
the same JSON wire representation on both sides and closes its Admin clients.

Network simulation is restored, the driver signs out, uninstall is acknowledged
and the phone session stops. Package absence is not independently proven. Both
owned local runtimes, the private session files and helper handoff are absent;
the helper group exits and all four loopback ports pass a bind/close check.
No real customer records, payments, app map requests or release scenarios are
accepted. The internal screenshots are not published or described as video.

## Automated Run

Run 40220500194 is bound to pushed head 566a994. All ten focused safety jobs pass.
The ordinary run observes 220 cases: 165 pass, 54 skip and one fails while
capturing `TripChangeFlowTest.largeTextParentSeesBothVersionsAndAcceptsWithoutApplying`
with `Failed waiting for PixelCopy!`. The later primary trip-consent-recovery
copy also fails with status 1. Policy restoration and host exit succeed, but do
not turn either failure or the whole native gate into success. Root causes remain
unconfirmed. The complete original transcript, result, copy receipt, failed job
log and authoritative run metadata are retained. No new automated media is public.

The local diagnostic build and all 567 Android unit cases pass. These do not
replace physical parent/child, outdoor movement, iOS, payment, urgent-email,
emergency dialer or safety-audit release evidence.
