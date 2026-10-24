# Profile City

`Ma ville` is an optional, private profile label. It does not supply a search or
publication origin, call a map provider, change a route or disclose a location to
club members. This profile-only scope was confirmed on 24 October 2026.

Authenticated `getProfileCity({})` and
`saveProfileCity({city, expectedRevision, requestId})` select the owner exclusively
from authentication. `city` is an NFC-normalized, trimmed, 1-100 UTF-16-unit label
or explicit `null` removal. Control/directional/hidden characters are rejected.
Read/write responses contain exactly `{userId, city, revision}`.

`profileCities/{uid}` is private and denied to all direct clients by the existing
catch-all rule. Writes use a transaction and the displayed safe-integer revision.
The last request identity/fingerprint permits a lost-reply retry without another
write. A conflicting payload is rejected; an older request after a newer edit or
removal is rejected by revision. Removal retains a null record to fence old creates.
No operation history grows per edit. Missing records mean unset; corrupt records
fail closed. Roles, claims, user initialization and all trip data are independent.

Android keys the editor to the authenticated user and gateway. Old-account replies
cannot populate the new profile. No successful save is shown until its exact owner,
city and revision are acknowledged. After an unconfirmed write, the payload and
request ID stay fixed for explicit retry; an explicit read reconciles current state
before editing again. Cancelled edits issue no write. No fabricated default city is
shown on missing data or read failure.

This is not a new child identity/provisioning policy or a verified physical location.
Backend/application changes require deployment before production availability.
