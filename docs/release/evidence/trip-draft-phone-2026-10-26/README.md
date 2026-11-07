# Physical phone: private trip draft after complete process stop

26 October 2026, Google Pixel 9 Pro, Android 15, isolated local services.
Two booked synthetic trips were prepared through authenticated local services.
The selected APK is from 1518a8b; native app and backend source are unchanged
through 398d207. The selected local APK hash is in ui-review.json; installed
device bytes were not independently hashed.

## Observed journey

The driver signed in, opened "Brouillon de trajet", entered raw invalid price
`4,`, origin `rue du brouillon qa` and destination `club du brouillon qa`.
The disabled submission button prevented proposing these incomplete details.
Closing the editor, visiting "Autre trajet sans brouillon" and returning kept
the first draft separate. The second trip still showed 2,50 and empty search
fields above its original synthetic coordinates.

The supported shell UI command `dumpsys meminfo be.sportgreenmoove.app.local`
showed PID 16948. Android App info > Force stop > OK was selected; Force stop
became disabled. The same command then returned "No process found for:
be.sportgreenmoove.app.local". Opening the app from App info returned to the
authenticated home without entering credentials. The first draft retained all
three exact raw fields; the supported shell UI subsequently showed PID 1308.
The second trip remained clean, and a further return restored the first draft.
Finally, sign out returned to the empty login form.

Process results above are manual live UI observations, not an independent
process receipt or a claim inferred from the record observer. No video was
accepted. Three original 960 x 2142 PNG captures were reviewed; none were edited.

## Independent checks and cleanup

Nine ordered observer checkpoints compare all shared root records, account
claims and live data against their baseline, ignoring only the selected driver's
profile updatedAt. All passed. Neither trip received a proposal, quote, balance
or ride session; both retained the original 250-cent price and bookings.
trip-records.json is a synthetic baseline projection, not the complete private
baseline and not a substitute for UI or process evidence. Executed observer
sources are retained by hash in source-archive.

After sign out, the provider acknowledged uninstall and returned to its device
dashboard after Stop Session. Package absence was not independently queried.
The owned scoped connection group stopped and its private handoff directory was
removed. The disposable runtime exited; its session file and service directory
were removed and all four owned service ports were closed (runtime-cleanup.json).
No device-administrator test guard was installed or changed in this trial.

## Boundaries

No map search, paid provider request, proposal submission, production write or
payment. This trial does not test schedule-picker drafts, another account,
another device, iOS, applying the proposed changes, routing or payment recovery.
It does not close the release readiness requirements or repair the separate
intermittent CI screenshot-copy failure.
