# Adult Booking Reply Loss On Physical Android

30 October, one Pixel 9 Pro / Android 15 and one isolated parent account. All
nine independent record checkpoints pass. The observer submits no booking.
There are no production writes, map requests or real payments. The trip's 3.50 EUR
price is fixture data; this is a requested booking, not an approval or charge.

The phone opens the explicit one-adult/one-seat confirmation. Opening does not
write a booking. The actual isolated callable commits one adult request, one
committed receipt and one driver notification. Only then does the scoped facade
close the downstream socket without releasing the successful receipt. The phone
shows `Demande non confirmée` and the explicit same-request retry. A sending-state
session capture is also retained.

After manual recovery, the phone's retry repeats the exact clientRequestId,
requester, trip, seats and displayed intent. The real callable acknowledges the
same booking. No second receipt, notification or booking appears. All committed
fields and timestamps compare equal in the retained snapshots. Original child
bookings, trip capacity, other documents, account claims and live data remain
unchanged. The inherited snapshot deliberately excludes only the parent's
initializeUserProfile updatedAt timestamp, not booking/receipt/notice timestamps.

The phone confirms the request, then reopens it as pending with no send action.
Actual Android Force stop is corroborated by PID 2666, no process, then PID 12273.
The parent returns without logging in. The same request is recovered from Home
and Mes trajets; the reservations list shows one adult request alongside the two
pre-existing child requests. The driver notification is verified independently
in stored records, not on a driver's phone. Final sign-out is observed.

The selected existing upload is `sgm-review-recovery-b015934-localhost.apk`, whose
source APK SHA-256 is retained. Android application and Functions source have no
diff from b015934 through the trial's base 2467e06. The new trial controllers were
uncommitted during execution and are bound by their exact retained source hashes;
do not call base 2467e06 their complete committed source. Installed remote bytes
were not independently hashed. The APK uses the original configured SDK route;
no app fallback, polling or alternate data source is introduced.

Five reviewed phone crops are published. Full original 1200x596 session-window
JPEGs, including the sending state and native process observations, stay retained.
The 200x444 crops are not native exports, upscaled reconstructions or video.
The host clipboard was restored, the remote clipboard replaced with a harmless
marker and the disposable session returned to its idle dashboard. The controller
closed both admin clients. Owned runtime/helper groups exited, all seven checked
ports closed and private handoffs/session data were removed. No independent
package-removal proof is claimed.

This trial restarts only after explicit retry has received its acknowledgement.
Restart while still unconfirmed, search-screen recovery, child multi-seat retry,
simultaneous devices, actual radio loss, iOS, payments/refunds, push and complete
release readiness remain open. Controlled response withholding is not radio-loss
or production-provider evidence. All earlier phone captures and dates remain.
