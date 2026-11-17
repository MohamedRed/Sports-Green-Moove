# Emergency Child Selection: Failed Native Trial

The focused job in run `39337180296`, source
`f23512c8ae46b40c2e286104b6c6baa2716ffe60`, finished with failure. Its first
scenario timed out after 60,000 ms waiting for the original child's contact
screen (`LocalEmergencyIdentityFlowTest.kt:60`). It never reached the host
recreation checkpoint, exported no passing identity marker and provided no
accepted identity screenshot. It is not a recreated-child UI pass.

Original negative instrumentation, process observations, per-command statuses
and the independent restoration receipt are retained under `failed/`. Temporary
administration and its component were verified removed. Later observation,
startup and remote-stop commands returned zero independently; they cannot turn
the failed identity command or focused job green. This is not physical GPS,
child-own-account access, a new dialer handoff or release approval.

The source audit found a real selection race: initial parent history loading
can release a child's picker row while the initial self-contact read is busy.
The route persisted and closed the picker before its asynchronous selection
command ran; the state silently ignored selection while busy. Only one contact
read occurred in the failed trial. The missing screen is consistent with this
race, but the trial did not export the visible editor's scope, so the exact
failure cause is not claimed as directly observed.

The correction makes target selection a synchronous accepted/refused transition.
The route persists its target and closes the picker only after acceptance. Picker
choices remain disabled while the contact read is busy. No delay, retry, guessed
contact, permission bypass or replacement data source is added.

Three targeted state regressions and the existing twenty contact-state cases
are recorded separately after execution. A seventh prepared component case holds
the initial history and contact replies independently, requires the picker to
remain open with its child row disabled, then requires the exact child subject
after the original read completes. Compilation is not native execution: the
corrected scenario and this delayed-reply component still require a passing run.
The original 60-second UI predicate and all five recreation checks remain.

`failed/source-files.json` binds the original failing source bytes. Checksums
preserve raw evidence; no failed transcript is rewritten as a passing result.
