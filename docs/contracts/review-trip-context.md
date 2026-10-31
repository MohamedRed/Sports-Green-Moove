# Pending Review Trip Context

Both inbox and continuation responses include `tripContext` on every review.
It is either `{tripId, title, departureAt, departureLabel}` or explicit `null`.
The target, rating ID, suppression and pagination rules do not change.

Only the selected page's unique valid trip document IDs are loaded, at most 20.
No extra participant, user, address, location or provider query is added.
Context is returned only when the queried completed ride points to a completed
trip owned by that ride's driver and the trip's `activeRideSessionId` matches
the exact ride. The original trip title and explicit-offset ISO departure must
be valid. Labels use `Europe/Brussels`, including summer time and a full year;
the device timezone cannot silently move the review to another day.

A missing, deleted, unfinished, malformed or unrelated trip returns `null`.
The review remains present with “Détails du trajet indisponibles”. No current-date,
ride-start-date, category-title, unrelated-record or alternate-source fallback
is introduced. Missing historical details are not repaired or claimed verified.
Title/date enrichment performs no writes and does not expose trip coordinates
or other stored private fields.

Android and iOS parse the explicit available/unavailable state, reject malformed
context and preserve the exact review identity. Titles and labels can wrap;
they are not ellipsized. New clients require the matching callable response;
deploy the server before compatible clients. This change performs no production
deployment, data migration or Terraform/index change.

Evidence covers 25 valid and seven unavailable contexts across two pages for
two authenticated accounts, summer/winter time, foreign-account rejection,
read immutability and one exact later-page rating. Nine local Android component
cases include three context cases. The native fixture and authenticated service
runner are separate: this is not an integrated phone/service, physical-device,
restart, network-loss, iOS UI or release result.
