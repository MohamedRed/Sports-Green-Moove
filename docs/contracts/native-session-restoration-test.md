# Local Session Restoration With Rotation

The existing four controlled restoration components do not prove the full app's
real SDK integration. The additional focused `session-restoration` case launches
the actual local-profile `MainActivity` with an existing synthetic parent session.
No production gateway or UI is replaced with a fake implementation.

Only the default Functions SDK endpoint is temporarily redirected to a supervised
loopback fault proxy. It verifies the selected parent identity and accepts only
empty `initializeUserProfile` and `getActiveRide` inputs. Initial restoration and
one actual landscape rotation receive explicit controlled 503 callable errors.
They are not a real connectivity outage or the previous transport stream failure.
The app must show its generic error and explicit retry/disconnect actions, without
signed-in or sign-in content and without publishing the private diagnostic detail.

After exactly two failed attempts, the test enables forwarding to the same local
backend and presses Retry. The same parent must reach Home. A return to portrait
must recreate the Activity and restore the same parent again. The profile must
show the synthetic parent's name and email. Exactly four restoration requests are
required: two rejected and two acknowledged by the actual local callable.
Read-only active-ride requests can run only after recovery. Unexpected requests,
identity changes, non-empty profile writes and extra automatic retries fail.

Five original app captures, a native marker, sanitized proxy receipt and exact
source hashes are retained. The account is signed out, Functions endpoint reset,
orientation settings restored, Firestore client terminated and proxy closed.
Every cleanup operation is attempted independently, and failures preserve the
original trial error. Top-level fixture collections, all account claims and live
trips must stay unchanged except the selected parent's expected `updatedAt`.
This does not claim a recursive audit of every Firestore subcollection.

This case uses its own fresh disposable device with the existing continuous
installation guard. Both local APKs are verified against their compiled hashes;
the guard is never opened for a reinstall. The existing aggregate check now
requires all five cases. The ordinary full native matrix is not removed or
shortened, and older four-case evidence keeps its original historical scope.

Preparation and compilation are not execution evidence. The corrected case still
requires a terminal successful native result, verified cleanup, retained original
artifacts and visual review before the partner portal can claim it passed.
It does not accept physical-device, physical network-loss, provider, payment,
store-review or safety-audit requirements. No application backend is deployed.
