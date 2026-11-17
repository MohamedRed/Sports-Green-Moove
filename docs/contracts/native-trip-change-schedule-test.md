# Native Trip Date And Arrival Test

`LocalTripChangeScheduleFlowTest` adds a separate required case to the real
isolated Android/backend replay. The fixture is a driver-owned trip with one
approved parent booking, no arrival deadline and an unchanged EUR 2.50 price.
It does not expand the earlier accepted time/price evidence merely by compiling.

The driver opens the actual native calendar, selects a different date and
cancels. The editor must keep the original date and remain unproposable because
nothing changed. The driver then selects a past date and sees the future-departure
validation with proposing disabled. After selecting the valid new date, the
driver explicitly sets the departure time using the native time picker.

Enabling desired arrival initially retains the draft's original date, now before
the changed departure. The chronology error must block proposing. The driver
selects the new arrival date and a time one hour after departure; only the valid
schedule can then be proposed. Both native pickers require their actual API-35
controls. The calendar uses the framework's localized day description and
previous/next month controls when the fixture crosses a boundary. It has no
coordinate, spinner, direct-state, retry or alternate-picker substitute.

Fixture departures are tomorrow at 09:00 UTC and the following day at 09:00 UTC;
desired arrival is 10:00 UTC on the latter day. Both time controls are explicitly
set from those instants in Brussels, so a daylight-saving offset change cannot
silently preserve the wrong local hour. Unit checks cover month/year/leap-date
and spring/autumn offset boundaries. These are fixture checks, not additional
executed native or physical-device scenarios.

The parent signs into their own account, opens their reservation, sees both
dated departures, no original arrival deadline, the new desired arrival and
unchanged prices. After accepting they must see one agreement out of one, a
recorded decision and no apply action. A synchronized dialog capture waits for
the busy marker to clear and still requires separate visual review for sharing.

Successful instrumentation and an acknowledged named evidence copy precede
independent host checks: one proposal only, exact terms and identities, unchanged
original trip/booking snapshots, unchanged coordinates/prices, scoped parent
review, outsider denial, no saved quote and exactly three unique notices. A
run-bound receipt cannot replace these saved-data checks.

Only that completed stage may emit `trip-change-schedule-ui-stage.json`. It is
explicitly not a full replay; all 27 groups, including the earlier price/time,
restart and strict network scenarios, remain mandatory for `results.json`.
No route/provider substitute, application, payment, consent recovery after process
death, actual arrival/tracking or physical-device proof is added. No new screenshot
is published until the native run and independent checks actually complete.
