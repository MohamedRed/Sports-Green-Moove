# Vehicle-Map Trial Stopped Before APK Installation

Manual run 39317434324 failed at source
9cced9ae8a21bd14eaf956f50b5c63fd25a24430. Artifact 12219412291 and the
original failed-job output are retained. The isolated app and map build succeeded;
device setup confirmed the approved test administrator. However, the standalone
entry had no ordinary instrumentation stage to activate `no_install_apps` first.
The guarded APK installer correctly refused the still-false restriction before
installing either APK. No map instrumentation or map screenshot was produced.
This is a test-launch sequencing defect, not evidence of a provider outage.

Both standalone map entrypoints now explicitly activate the approved restriction
after registering cleanup and before preparing the local service runtime. This
also closes the unlocked interval while the local services start. Activation
checks the exact disposable serial, owner, account count, original policy, idle
installer and unchanged maps/location runtime. It refuses an already-locked or
foreign setup; it never clears an unexpected restriction or retries a failed
write. The existing two-APK window and re-lock checks are unchanged.

The original final receipt records restored settings and removal of both the
administrator authorization and helper, with `verified=false` because no replay
guard was activated. The diagnostic transfer also failed because the app evidence
directory did not exist; that failure is retained, not accepted as primary proof.
Service shutdown appears in the original log. The failed owner did not emit a
separate runtime-disposal report, so none is invented retrospectively.

The sequencing correction has unit coverage; its actual native rerun remains
required. Vehicle-map loading and movement, child positions, ETA, physical tracking,
payments and release readiness remain unverified here. The separate complete
local matrix at 67ab59c remains successful and unchanged.
