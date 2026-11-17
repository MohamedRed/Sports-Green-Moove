# Read-only callback runtime observation

The latest recorded readiness job fails on the refresh callback's existing
15-second request deadline. Its source/run/job identity is in `observation.json`.
No timeout is extended and no failed response is reclassified as success.

Read-only Cloud Logging queries observe two HTTP 500 requests for the refresh
service in the same time window. URLs and client addresses were not collected,
so these entries are not proven to be the CI health request. The selected
payloads establish no startup, memory, credential or capacity cause.

The read-only service view reports a ready revision with a single-instance,
single-request limit, fractional CPU and 256 MiB memory. Those configuration
values do not prove why a request failed or timed out. The source's health branch
returns before onboarding work, but production execution of that branch is not
established by an HTTP 500 entry.

The initial overly narrow field projection was rejected with HTTP 400. The
corrected log query and service query succeed; this was not an established
authentication outage. No credentials, environment values, raw request URLs,
client addresses or provider payloads are retained.

No service, scaling limit, permission, billing resource or deployment is changed.
No payment, onboarding retry, fallback or extra phone session is performed.
The earlier passing configuration check and the later failure remain distinct;
this observation accepts no release-readiness item.

API references: [log-entry reads](https://docs.cloud.google.com/logging/docs/reference/v2/rest/v2/entries/list)
and [service reads](https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.services/get).
