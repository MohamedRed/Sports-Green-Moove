# Invitation Components Executed, 26 October 2026

The three `ChildInvitationFlowTest` methods compiled in the previous record now
actually execute and pass on the isolated Android emulator for `f773b3d`:

- Creating a link passes exactly that link to the injected share callback without
  displaying its secret.
- An explicit revocation disables sharing.
- A consumed invitation cannot be reused at 320 dp and large text.

These are component tests with fixture gateway and share callbacks. They do not
open the real system share chooser, create a connected account, complete parent
approval, open a dialer or validate a physical device journey.

The original ordinary matrix has 177 passing, 54 skipped and zero failing cases;
all three invitation cases are among the 177 passes. Original JSON, JUnit-style
transcript and device restoration are retained. The APK hashes bind the ordinary
matrix preparation. The source snapshot from the initial invitation record still
identifies these exact component methods.

The complete Native CI run is **failed**, not green. A later connected replay
fails its ADB file pull during `trip-change-parent-confirmation`. The original
failure receipt shows exit status 1 and an incomplete file-list operation, but no
reported offline transport or daemon restart. That does not prove its underlying
cause or an application assertion failure. Do not discard it or promote the
passing ordinary matrix into a passing full gate. Device restoration verified
removal of local packages, the temporary administrator and its policy.

No new gallery media or production/release acceptance is claimed.
