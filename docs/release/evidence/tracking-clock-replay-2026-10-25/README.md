# Native Capture Clock And Physical Phone Replay

25 October 2026. The candidate APK uses isolated loopback services through the
scoped private connection. Pixel 9 Pro / Android 15, simulated driver GPS only.
No production accounts, route-provider request, payment or production deployment.

## Observed

The driver starts the booked test trip through the app. GPS A is accepted, then
GPS B advances both capture and upload times. With the app on the system Home
screen, GPS C also advances. Returning to the app preserves the same active
ride. Signing out returns to empty login fields. A later GPS D does not change
any live-trip record during an additional measured 50-second read-only watch.
All unrelated root documents, claims and bookings remain equal to baseline.

The original observer is **incomplete**: its final command was requested before
its 50-second minimum, and it correctly failed. Its original report is retained
unchanged. A supplemental read-only observer independently compares every root
record before and after a fresh 50-second watch. The first supplemental attempt
compared Firestore timestamp instances to saved JSON objects and failed before
waiting. Its negative output remains retained; the corrected comparison uses
the same JSON wire representation on both sides. Neither result rewrites the
original observer as complete.

Seven original 253 x 564 browser-viewport JPEGs are retained without scaling.
Three reviewed app views lead the public tour. They are not native-resolution
exports or a video. The browser reports that recording cannot start without
screen-sharing permission; its diagnostic is retained, not published as a flow.
No browser restart or system permission change was performed.

## Implementation And Checks

The authenticated server response supplies the epoch reference. Captures use
the sensor monotonic timestamp, preserving each sample's age rather than
substituting upload time. Raw device wall-clock time is audit metadata only.
Calibration epochs are prospective and bounded; delayed responses cannot
retroactively remap an assigned capture. A newer reference can recover from a
slow response. Service handoff preserves history, while lease ownership and
sign-out/revision checks remain enforced. Invalid/future backend rejection is
unchanged. No device-clock or receipt-time fallback is introduced.

The source snapshots bind the uncommitted candidate based on f3aef02; that base
commit alone is not the APK source claim. Retained unit results: 564 Android
JVM cases (21 capture-clock cases), 482 backend cases, and 2166 root Node cases.
These unit results predate the added replay-evidence checks. Their final rerun
is reported separately in Git/CI, not inferred from the old transcripts.

Four local connected attempts remain negative, with original source snapshots,
diagnostics, preparation/restoration and disposal receipts:
1. Control read hangs before native startup; reused SDK database instance fixes it.
2. Startup checks a localized display status as an internal enum; removed that
   invalid assumption, retaining the selected authorized active-ride ID guard.
3. APK changed after device preparation because build/setup overlapped; the
   preparation guard rejects it before instrumentation. Build was awaited for
   subsequent trials.
4. App process fails launch/ANR without a test marker; cause not established.

No local connected test pass is claimed. All four owned devices were restored
and removed. The physical session stops at the idle dashboard. Its uninstall
action reports no user apps found; independent package absence is not proven.
Both observer clients close, owned helper exits, private handoff/session/runtime
are removed, and all four loopback service ports are independently bind-tested.

## Still Open

This proves neither outdoor travel nor a parent phone seeing the vehicle on a
map. Maps are intentionally unconfigured in this build. Child consent/access,
pickup/dropoff tracking, real GPS loss, network loss, screen lock, process
restart, battery saver, delayed webhooks, iOS and provider/release acceptance
remain open. No release manifest scenario is accepted by this replay.
