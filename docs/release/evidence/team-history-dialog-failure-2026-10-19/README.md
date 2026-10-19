# Original History Dialog Capture Failure

Native run 39250226581 at `e3ddba1` completed with a failing ordinary suite.
The unchanged JUnit file records 154 cases, 34 skipped, 120 executed, one failure
and no errors. Three of the four new history component cases passed. The narrow
large-text child case passed its visibility, redaction and absent-action assertions
before failing during screenshot capture.

The failure contains two Compose roots: the 840x2400 app window and the 840x629
dialog window. Calling the existing capture helper in its default root mode was
ambiguous. The correction explicitly selects its existing dialog mode and the
short dialog's observed wide orientation. The separate full-device companion
remains portrait. No assertion, timeout, required image, count or blank-image
guard is removed or retried. The correction compiled locally; execution of the
corrected component case remains pending until a new original transcript passes.

The paging PNG and device companion are original explicit-fake-gateway component
captures, not service-connected or phone proof. The original suite status remains
ordinary=1, component evidence=0, local replay=0: later local replay success does
not turn this whole run green. The original cleanup receipt verifies removal of
the temporary admin/helper and restoration of device policy. No physical or
release requirement is accepted by this evidence.

The separate five-step physical history replay is retained in
`../phone-team-history-2026-10-19/`; it does not replace the failed narrow component
capture. Source versions are recovered by exact hash from the tested Git commit.
