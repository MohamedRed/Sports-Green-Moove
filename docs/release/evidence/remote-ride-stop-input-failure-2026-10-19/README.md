# Remote Completion: Input Injection Failure

The first attempt with the service-owned lifecycle watch failed before the peer
completed the ride. `UiDevice.pressHome()` returned false. The original native
case, transcript and diagnostics are retained unchanged. The completion-aware
isolation check also failed because this unfinished ride had no completion
ledger entry. Neither failure is accepted as a successful run.

The next version explicitly moves the Activity task to the background and still
requires `Lifecycle.State.CREATED`, a live service before remote completion,
service termination before resume, and the same signed-in driver. This changes
the test's backgrounding action, not the service-stop assertion. It adds no retry
or alternate capture path. These records are local synthetic trials only.
