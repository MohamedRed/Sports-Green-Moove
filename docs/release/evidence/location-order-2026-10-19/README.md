# Monotonic Live Location Writes

The actual isolated before-run reproduced a delayed native upload replacing a
newer captured location. `before-failure.json` and `before.txt` retain the failed
assertion, original timestamps and changed coordinates. That run is not accepted.
An earlier attempt stopped at the Java prerequisite before executing the scenario;
the retained reproduction used Java 21 and shut down its owned emulators normally.

The shared writer now uses an atomic per-location transaction. Only a valid,
strictly newer observation time replaces the current point. Receipt time and
provider priority cannot win against a later capture. Equal-time duplicates keep
the first accepted point and its receipt time. Invalid or future incoming times
do not poison the location register; a valid capture can replace an unverified
legacy record. No timestamp is guessed and no new fallback is introduced.

`services.json` and `services.txt` retain the completed ten-group run. Actual
authenticated native callables covered delayed/duplicate points, twelve concurrent
requests, the participant parent's capture-age response, denied parent writes and
an older batch reporting zero committed points. The actual shared administrative
writer covered ordering across sources, independent vehicle/child registers and
invalid/future times. The real local reconciliation function retained a delayed
event's audit record without moving the vehicle position backwards. These direct
administrative checks do not prove child-device authorization or signed webhook
delivery; those are separate requirements.

The administrative client closed before writing the positive result, the original
script exited zero and all owned emulators stopped. `full-functions.xml` contains
338 passing cases, including twenty new ordering cases. `results.json` and the
source archive bind the exact before/after source bytes; artifact hashes preserve
the raw reports and transcripts. No existing negative evidence is replaced.

This is not a screen replay, physical GPS, provider delivery, network recovery,
store approval or accepted safety-audit export. Live screen/map refresh, ETA
ordering, provider timestamp provenance, device clock differences and all physical
tracking scenarios remain open. No production deployment or write, customer data,
real payment or paid provider request was made. The portal tracking flow remains
untested; these narrower data checks do not establish a complete user flow.

Subsequent review reproduced a transaction-reevaluation clock race not exercised
by these first ten service groups. The negative protocol test, final correction,
341-case unit suite and repeated ten-group service run are retained separately in
`../location-order-reevaluation-2026-10-19`. This original run is not substituted
for that later source verification.
