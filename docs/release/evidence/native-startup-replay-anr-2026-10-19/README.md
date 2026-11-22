# Original Full Replay Interrupted At Process Startup

Run `494e97889107828a61550b0d6846cf6d` passed the guardian-parent,
emergency-contact and team-enrollment cases, followed by the original nine-case
app/driver/landscape/search group. Its next original case,
`LocalThemeRestartTest`, did not complete: instrumentation reported
`Process crashed` and the host exited unsuccessfully. No full replay pass exists.

The retained Android exit record classifies the failure as a startup ANR, and its
original process log shows substantial CPU pressure. Android could not obtain a
usable thread dump before its deadline. There were no active install sessions in
the retained diagnostic. These observations do not establish a code-level cause,
prove that more memory is a remedy, or justify skipping the restart assertion.

The ride-permission synchronization change was not reached in this replay, so
this run cannot verify that repair. Prior passing runs are historical evidence,
not substitutes for this failure. No physical tracking or release acceptance is
supported by this diagnostic.
