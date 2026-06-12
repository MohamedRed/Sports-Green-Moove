# Carpool Matching

V1 uses deterministic scoring in Cloud Functions. It does not use ML or OR-Tools.

## Candidate Filters

- Trip is `published`.
- Enough available seats.
- Club/team/category match.
- Departure/arrival time fits the requested window.
- Region/geohash is close enough for initial lookup.
- Baggage and return-trip requirements are compatible.
- Driver is verified and not blocked by the requester.
- Parent/child has guardian consent and compatible memberships.

## Score Inputs

| Input | Direction |
| --- | --- |
| Driver detour minutes | Lower is better. |
| Driver detour kilometers | Lower is better. |
| Passenger pickup distance | Lower is better. |
| Schedule delta minutes | Lower is better. |
| Same club/team | Better. |
| Driver rating/trust score | Higher is better. |
| CO2 saved kg | Higher is better. |
| Price cents | Lower is better. |
| Tracking support | Required for child rides; ranked higher when present. |

Cloud Functions use Google `Compute Route Matrix` for candidate comparison and `Compute Routes` for final route details returned with each ranked match. Missing `GOOGLE_MAPS_API_KEY` is a configuration error; the backend does not silently fall back to a local distance estimate.

For each candidate, the matrix request compares:

- driver origin to driver destination for the baseline.
- driver origin to passenger pickup.
- passenger pickup to passenger dropoff.
- passenger dropoff to driver destination.

Candidates with no valid driving route are skipped. Provider/API/configuration failures are not hidden.

The result must explain every match with human-readable Belgian French reasons such as `+6 min détour`, `2 places disponibles`, and `Même équipe U8`.
