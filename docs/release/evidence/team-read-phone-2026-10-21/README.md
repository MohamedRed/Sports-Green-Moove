# Team Unread State On A Physical Phone

On 21 October, eight manual native UI stages passed on one physical Google
Pixel 9 / Android 15 through the existing App Live subscription. Only the
isolated `demo-sgm-local-qa` backend was connected. The APK digest and tested
source are pinned in `results.json`; no app/backend production deployment occurred.

The parent sees one unread message, opens it, receives a second driver message
while outside the thread, opens it and sends one reply. The driver then signs in
on the same phone, sees one unread reply and opens it. Returning to the parent
does not restore unread counts. Eight independent persisted checkpoints verify
three exact actor/message/timestamp receipts, four messages/operations, the
admission boundary and 158 protected baseline records. The other verified
parent stays at three unread messages. The record controller never acknowledges
reads or sends the parent's reply; its original report makes no UI claim.

## Capture Scope

Original browser-stream contexts are retained unchanged. The eight published
JPEGs select the declared 250 x 558 device rectangle from those contexts with
no retouching, text replacement, upscaling or generated imagery. They are
lower-resolution streamed observations, not native 1080 x 2400 PNG exports.
Every selected frame was visually reviewed. The original first bounded browser
capture and the separate cleared-counter/profile contexts also remain retained.

The native export's Save dialog kept Save disabled in both the temporary folder
and Downloads. Both attempts were cancelled. A supported download observation
timed out; two later bounded screenshot observations timed out too. These do not
prove native-export success or an app defect. No video was recorded. A first
noninteractive controller preparation exited 13 before UI checkpoints; that
environment was destroyed before a fresh interactive run. No phone flow is
accepted from that preparation.

## Cleanup And Remaining Work

The service reported app uninstallation, then its uploaded-app dashboard was
observed without a live session. No independent package inventory was read.
No device administration, update policy, network shaping, permissions or personal
devices were changed. The scoped helper stopped and removed its private pipes.
The backend stopped, its private session disappeared and all four approved
loopback ports refused connections. Its initial cleanup exited 1 with ENOTEMPTY
on a remaining CLI configuration directory. After verifying the owned processes
were absent, that exact disposable directory was removed and verified absent.
This warning is preserved rather than reported as a clean initial shutdown.

This proves sequential accounts on one physical phone with isolated data, not
two phones, push notifications, offline recovery, tracking, payments or release
readiness. The full native CI run still fails separately; this phone result does
not supersede it. The release manifest remains unchanged.
