# iPhone Account Refresh

The original `AppState.refreshAppData` at `55822999ff5d31b792c71bd78b6ae0e59a743851`
assigned each response directly and continued reading after sign-out. A controlled
first response reproduces the defect using the actual baseline `AppState.swift`:
private trips/children return while `session` is nil, and seven reads execute.
The candidate ignores that response and makes only the first read. Both executables
use the same current Foundation-only dependencies and explicit isolated gateways;
this is an AppState regression comparison, not a full historical app build.
The common reproduction entry point and original output are retained here.

The candidate extracts a typed snapshot loader. Each await boundary checks current
request ownership, UID, selected role and task cancellation. Only a complete,
still-owned snapshot is applied, synchronously on the main actor. UID or role
changes revoke the request even when the same UID or role returns later. A failed
current read reports failure and retains the previous complete snapshot; it does
not fabricate or expose a partly loaded replacement. An explicit refresh can retry.
Refresh busy state is separately owned, so an old completion cannot clear a new
refresh or another operation's loading flag. Payment controls include that state.

The ordinary Swift 6 native checks compile the actual AppState and execute:

- Sign-out at all seven parent read boundaries, for both late success and late failure, with no further reads or data restoration.
- No provider read when signed out; no partial snapshot during loading or failure.
- Account replacement and sign-out/reauthentication to the same UID.
- Role replacement and return to the same role.
- Old success and old failure while a newer request remains busy.
- Old failure after a newer successful snapshot.
- Task cancellation, current failure, explicit recovery and driver-specific reads.

`summary.json` records the log hashes and scope. `source-sha256.json` pins every
source in the native check command, its script and the reproduction entry point.
The older baseline AppState is separately identified by its original SHA-256.

These are local race tests with controlled in-memory provider responses, not an
SDK-connected or rendered iPhone journey. The profile sign-out button remains
unwired; identity display, authentication-completion ownership and tracking
teardown also need separate work before a complete session-exit claim. No call,
payment, real account, production write, new native image or physical GPS test
was performed. Both platform requirements and the release manifest stay open.
