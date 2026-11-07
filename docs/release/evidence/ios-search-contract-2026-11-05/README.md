# iPhone Search-To-Booking Data Contract

Checked 5 November 2026. The pinned `cd76635` gateway accepts eight of eight
malformed search results, including a missing paid price displayed as free,
boolean/fractional capacity and a missing booking snapshot. Its executed negative
result and exact production source remain frozen and are not accepted.

The candidate replaces guessed defaults and silently dropped rows with one strict,
atomic decoder. It requires complete labels, exact trip identities, safe integral
capacity bounded by the requested seats and total, a valid booking snapshot,
the corresponding price/capacity labels, finite positive scores, valid route
metrics and matching endpoint data. Optional encoded routes must be bounded,
syntactically complete and contain valid coordinates; contradictory route previews
are rejected. No real route service is called and no new fallback is introduced.

The actual current server summary serializer feeds three synthetic results into
the actual Swift gateway, using scripted SDK callbacks. Displayed labels, route
endpoint fields and the complete booking snapshot survive unchanged. The outgoing
booking payload retains the second child and exactly two seats. Sixty malformed
response groups, three direct nonfinite scores, four delayed transport/identity/
cancellation callbacks and one pre-call identity denial pass. Empty results remain
valid. This does not execute a booking transaction or validate real map geometry.

All earlier native logic checks and strict concurrency signatures also pass.
The new runner supports macOS and Linux explicitly and is added to the existing
web smoke job after its backend build. Local execution is macOS; its new Linux
execution remains pending. No existing workload, upload or assertion is removed.

The attempted separate booking-service recheck stops at its unavailable configured
Java prerequisite before any assertion group; it is not accepted as service proof.
Its failure does not invalidate the independently executed serializer/gateway
checks. The eleven iPhone UI cases, approved 50 minutes and optional capture
bounds are unchanged. Current SDK/UI, live service/map integration, full booking,
physical-device, safety/operational and release acceptance remain open. No new
phone session, provider request, payment, production write or media is involved.
