# Two-Seat Booking Decisions On A Physical Phone

Eight reviewed browser-stream captures document the completed 22 October trial on
one Google Pixel 9 Pro / Android 15. Driver, parent and driver accounts are used
sequentially. Two synthetic two-seat requests for Lina are prepared through
authenticated isolated services, not through the parent's search/request UI.

The driver approves one request and declines the other. The parent sees both
decision notices, cancels the approved free booking and observes capacity return
from two to four. The driver sees only the cancellation notice for this trial.
All six independent record checkpoints pass, preserving 158 baseline records and
the original account claims. Each phase checks exact bookings, child, seat count,
trip capacity, deterministic notices and intended inboxes; the outsider sees none.

The app is the previously uploaded 458318c build with the recorded APK digest.
Backend sources use base commit 24218efd. The corrected controller's exact
working-tree bytes are retained separately and do not claim to be in that APK.
The first attempt remains incomplete: its driver approval is visible, but the
controller wrongly treated approved reservations as pending. Its original report,
capture contexts and observed endpoint contract remain under `first-attempt/`.
The corrected trial uses a distinct phone session and a fresh isolated backend.

The private helper's startup-only log identified SYS_CONFLICT:1001: the old desktop
connection occupied ports 45690 and 45691. This matches the vendor's
[documented error](https://www.browserstack.com/docs/local-testing/binary/errors/1001).
After explicit user approval, only that connection's verified process group was
terminated. The normal restricted helper then connected with verbosity zero.
The diagnostic used a private FIFO, bounded memory and redaction; no raw log file,
request body, API logging, force-local routing or new audience was enabled.

The eight published JPEGs are declared 278 x 620 stream rectangles, not native
exports. Unchanged 1440 x 778 contexts, confirmations and an in-flight frame stay
retained; the latter is not published. No video was recorded. Remote keyboard
input initially altered an email character; native clipboard insertion was used.
No credential-input capture is retained or published.

The provider confirmed app removal and returned to its dashboard. Independent
package inventory was not read. Device administration, update policy, network
shaping and location permission were not changed. Both owned backends and their
private session files were destroyed, the helper stopped with verified cleanup,
and all six service/helper ports were closed. Disposal has its own receipt; the
controller's original report is not rewritten to claim it performed that cleanup.

This does not verify parent search/request UI, simultaneous phones, push alerts,
physical tracking, payments/refunds, production deployment or release readiness.
Older local and physical evidence keeps its original scope and date.
