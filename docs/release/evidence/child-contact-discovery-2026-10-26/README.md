# Child Contact Discovery, 26 October 2026

An isolated regression reproduced an approved child login receiving no ride from
the adult discovery endpoint: bookings contain a child profile ID, not that
child's authentication UID. The known-ride contact read already succeeded.

The dedicated child endpoint now resolves the private, parent-approved link and
immutable profile before selecting the newest active ride. Discovery and the
known-ride read share the same transactional contact/authority checks. Responses
contain only the child's own contact view, never the adult passenger/location
payload. Invalid newest rides fail closed instead of trying an older ride.

The authenticated replay creates the booking and ride, obtains a child code and
executes actual parent approval before discovering the contact. It checks twelve
authority/identity changes against both endpoints, explicit no-active-ride,
strict input, account isolation and newest-ride ordering. No link is preapproved.
The entire owned local runtime is disposed and its ports are confirmed closed.

Fifteen focused JVM cases pass and the Android test APK builds. The child entry
does not depend on the adult ride payload or location permission. Existing
denied-location components now exercise discovery without an adult active ride;
their compilation is not evidence that they executed in this replay.

No phone, new screenshot, real dialer handoff, child signup, live child tracking,
production write, provider request, iOS or release acceptance is claimed. The
previous incomplete phone attempts and their original images remain unchanged.
`results.json`, `android.json`, original JVM XML, disposal and checksums retain
this narrower result. Source hashes resolve to immutable source archives.
