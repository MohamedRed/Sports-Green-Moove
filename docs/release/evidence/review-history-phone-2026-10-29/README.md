# Review History On One Physical Android Phone

29 October 2026, isolated `demo-sgm-local-qa` data. Seven stored-state checkpoints
and seven original JPEG session-window crops. These are not native screenshot
exports or a video. All displayed content is synthetic.

## Observed

1. After 104 fixture-prepared reviews, the driver's Reviews tab has no request.
2. Preparing one new completed ride produces exactly one request.
3. The driver taps five stars on the phone: 105 ratings, no driver request.
4. Leaving and reopening Messages keeps the submitted request hidden.
5. After driver sign-out, the parent has their own 27 requests.
6. The parent taps five stars on the first original ride: 106 ratings and 26
   parent requests. The driver's submitted reviews remain hidden.
7. Parent sign-out returns to an empty login form. The observer closes cleanly.

The observer prepared the first 104 ratings through authenticated service calls,
and all 27 completed rides as fixtures. It submitted neither additional review.
Each checkpoint verifies all original rating bytes, completed ride documents,
158 protected pre-existing records and original claims. Actor initialization
timestamps alone may increase. Original readback snapshots are retained in
`records/`; `ui-review.json` is a separate manual UI observation, not independent
UI instrumentation.

## Identity And Limits

One Google Pixel 9 Pro / Android 15 was used, with two sequential accounts.
Selected app: `sgm-trip-cancellation-isolated-ce93-20261028.apk`, local package
`be.sportgreenmoove.app.local`, version 0.1.0. Its source baseline is
`ce93e568b7f636c0d6ce39f91daec4c4b80d72e7`; source APK hash is retained in
`summary.json` and the earlier cancellation bundle. Installed bytes were not
independently hashed. Review inbox state, cards and mapping sources have no diff
between that baseline and `0c5fa32c1bad24d4073d34d89dc2c4f676a46113`.
The current backend inbox correction was served by isolated local services.
Executed observer/helper/backend source hashes have exact retained source files.

This does not prove account creation, completing rides through UI, process
restart, received-rating display, lists exceeding the existing ride query windows,
simultaneous devices, production or release readiness. No maps, real payment or
production writes were exercised. The earlier old-handler failure remains in
`../review-history-2026-10-29/`; it is not overwritten by this replay.

## Preparation And Disposal

The first private helper expired during login preparation. A newly connected
helper served the successful sign-ins and calls. No app network-recovery claim
is made. Remote input initially produced a malformed email; exact one-time
clipboard paste resolved that test-control issue. The ephemeral password was
not retained or displayed in evidence. The remote clipboard was then replaced
with non-sensitive text and the original empty local clipboard restored.

After the empty login checkpoint the provider returned to its idle dashboard.
The observer exited 0; owned service and helper launchers exited 130 after SIGINT.
Their supervised groups stopped. Independent checks found all six ports free,
the private session and helper directory absent, the helper PID absent, and no
local-runtime directories. No other browser session was restarted.

`artifact-sha256.json` covers every retained artifact except this README.
`tests/review-history-phone-evidence.test.mjs` replays original checkpoints and
rejects inflated scope, changed bytes, missing observations and incomplete cleanup.
