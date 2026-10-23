# Booking request and driver notice: physical Android observation

23 October 2026. Isolated demo accounts and services only. No production mutation,
money, maps request, real call, or location tracking.

The parent requested one free adult seat from the upcoming-trip card on a Google
Pixel 9 Pro / Android 15. The app displayed the request-sent confirmation.
The first remote session then ended after the parent signed out. Its cause is
unknown; the private helper also exited with code 0 without an observed cause.

On a replacement Google Pixel 9 / Android 15, the driver saw exactly the new
generic request notice, marked it read, signed out, and switched to the parent.
The parent did not see the driver notice; its existing approval notice remained.
Returning to the driver showed the original request notice still read.
These were sequential devices, not a simultaneous two-phone trial, and not one
uninterrupted same-device flow. Remote typing required correction; sign-in
success was observed before the next action, without retaining credential images.

Six independent read-only checkpoints corroborate one requested booking, one
committed request receipt, one driver-only notice, unchanged four-seat capacity,
and the exact first read timestamp across account returns. All 159 baseline
records, claims and live-trip data remained unchanged, except the explicit parent
and driver profile timestamp exclusions. The observer seeded the free trip but
did not request, approve, cancel, or mark notifications read. Its results alone
explicitly do not prove a phone UI action.

The selected existing APK was observed in the provider UI. Its client source
commit was 87082b10; main Android client source had no diff to backend commit
4d414f9f. Installed APK bytes were not independently hashed in this trial.
The source copies and checkpoint JSON are exact originals; screenshots are
unretouched browser captures cropped to the visible app, reviewed for synthetic
data only. Screenshot timestamps come from the original capture file metadata.
No video was recorded. No whole-process restart, response loss, request retry,
address search, child booking, push delivery, physical tracking, or release
acceptance is established by this evidence.

The observer closed. Both helpers' private directories were removed; the owned
backend exited 130, its disposable directory and private session file disappeared,
and ports 5001/8080/9000/9099 closed. The second phone was observed signed out and
the session stopped. Uninstall was attempted, but the provider reported no user
apps found; independent package removal and provider reset are NOT verified.
No device administration, update policy or location permission was changed.
The RAM credential was discarded; clipboard restoration is not claimed.

`results.json` separates manual UI observations from `checkpoints/session-results.json`.
`cleanup.json` retains verified cleanup and explicit limits. `artifact-sha256.json`
covers every retained artifact except this narrative and the hash list itself.

The full native CI run 40032142064 ended cancelled on the same backend head.
All ten focused native safety jobs passed; cancellation is not an aggregate pass.
No new failure cause is inferred from that status.
