# Parent Booking On A Privately Connected Android Phone

On 18 October, the isolated app ran on a BrowserStack App Live Google Pixel 8,
Android 14, using the existing subscribed plan. This is a manual physical-phone
parent journey with real local emulated services and an authenticated driver
peer call. It is not a native driver test, two-phone replay or production result.

The APK was built from `f20fb884000ae491414faa0fb9c8d4b73f5e4eae` with
`SGM_USE_FIREBASE_EMULATOR=true`, host `127.0.0.1`, package
`be.sportgreenmoove.app.local`, project `demo-sgm-local-qa`. Its SHA-256 is in
`results.json`; no APK credentials or session-password files are retained here.
Subsequent portal-only commits `66cb38e` and `f27daa0` did not change native or
Functions sources. The ordinary `.local` build kept all live providers disabled.

## Observed Journey

The app opened and rejected an empty login, then a newly created synthetic
parent signed up through the private connection and reached the authenticated
home screen. These setup observations are not counted as three additional
booking checkpoints and have no retained signup recording.

The parent requested one free seat from the upcoming trip list. The Reservations
tab showed **En attente**. Independent reads found one booking and one request
receipt, with four seats still available. The separately authenticated fixture
driver approved through the callable API, not a phone screen. The parent pressed
**Actualiser** and saw **Approuvée**; the independent checkpoint found three seats.
The parent opened **Annuler la réservation**, reviewed the confirmation, confirmed
it and saw **Annulée** with no cancellation button. The same booking was cancelled
by that parent, four seats were restored, and one approval and one cancellation
notification record existed. These are stored notifications, not verified push
delivery. No payment, adjustment or refund was exercised.

Three original 1080 x 2400 device PNGs were saved through the service's screenshot
control and reviewed. They show the same trip, one seat, free price and matching
request identity. Raw checkpoints and the actual driver-call receipt are retained
unchanged. An initial approval checkpoint was attempted before the asynchronous
driver command completed and rejected the still-requested state; no receipt was
accepted from that premature read. Only the later read after successful peer
completion is retained as the approved checkpoint. No approval action was retried.

## Isolation And Limits

The signed/notarized official desktop helper was used. Its active console was
read back into `connection-policy.json`: only four loopback demo service ports
were allowed; Force Local, verbose/request API logs, MITM proxy and folder access
were off. Chrome's testing-site-only Apps on device permission was enabled for
helper detection. No subscription change, public tunnel or production write was
performed. The test phone was released, the helper disconnected, owned helper
processes stopped and the local service session closed; its private session file
was confirmed removed. Chrome was not restarted.

Video recording failed to start with the service's operating-system screen-sharing
permission message. There is no new video. Clipboard-based exact email paste was
used after remote key events entered `2` for `@`; the corrected synthetic address
was verified before signup. Do not publish credential-entry footage or raw logs.

Still unproven: driver approval UI on a phone, child/guardian booking, multiple
seats on this phone, refusal, lost replies, process restart, two phones, live maps,
payment/refund, tracking, iOS and production behavior. The release manifest stays
unchanged. The overall testing goal remains active.
