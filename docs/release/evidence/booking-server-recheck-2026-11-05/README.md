# Current Isolated Booking Transactions

Checked 5 November 2026 against the unchanged booking handlers from `9ae6ea7`.
All fourteen groups execute and pass using a disposable local database. Mutations
occur after preflight but before transactional reads: price, departure, endpoints,
arrival, applied revision, revoked guardian, deleted child, changed child label,
cosmetic title, closed trip, pending proposal, lost capacity and a confirmed change
applied to an existing booking.

Changed agreements or authority create no stale new request. The two permitted
cosmetic updates retain two seats, the current child label and the requested
status. The application case runs the real local proposal, parent acceptance,
quote and application services before rejecting the older agreement. Its single
route-provider invocation is an explicit synthetic test implementation, not a
billable map request. No real payment or customer data is involved.

The earlier prerequisite failure remains unchanged in the separate iPhone search
contract evidence. The installed Java runtime was not selected by child-process
lookup. The test runtime now honours an explicitly configured `JAVA_HOME` in its
own `PATH`, without changing the user's environment, installing anything or
choosing an alternative runtime. Invalid explicit configuration fails before a
temporary runtime is created. Eleven environment/disposal tests pass, including
an actual child executable-selection regression. The fourteen service groups
then pass without a manual `PATH` override. All four local endpoints are verified
closed after successful disposal.

The iPhone source, native checks, fixture sources and verification workflow remain
byte-identical to `9ae6ea7`; their identity list is retained. The live iPhone job is
not restarted or accepted by this service proof. Existing screen assertions,
eleven cases, 50 minutes and capture bounds are unchanged. This exercises handlers
and database transactions with explicit test authority, not the callable HTTP
authentication handshake, native SDK, phone UI, real map or full booking journey.
Physical, safety/operational and release acceptance remain open. No new phone,
media, production write, external provider request or cloud resource is involved.
