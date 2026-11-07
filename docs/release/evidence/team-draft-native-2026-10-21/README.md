# Team Draft Survives Two Process Stops

The unchanged three-method native scenario passed on corrected source
`eae253539b8db3fe01ece51f08ebb8b5d26b49c5`, run `39635801559`, job
`119345801082`, artifact `12363330257`, at 16:41 UTC on 21 October.
All three original instrumentation transcripts passed one test each.

The parent types an unsent draft. Independent stored-state verification finds
only the original two seeded messages and two operations. The host issues a
force-stop and verifies no process remains. A distinct process restores the
same authenticated parent and team, recovers the draft without retyping and
sends it through one physical UI tap. A separate driver SDK reads the exact
message. Another verified host stop precedes a third distinct process: the
sent message is visible and the composer stays empty. The parent signs out,
the driver signs in and its composer is empty too. Process IDs are 5117, 5552,
5768. Before each explicit host stop, instrumentation had already exited;
`observedBeforePid` is therefore null, not evidence of a still-running app.

Final independent storage verification finds exactly three messages and three
operations, exactly one explicit parent send, and preserves 158 protected
records and original account claims except expected profile timestamps.
The owned local backend is destroyed and endpoints are verified closed.
The disposable phone's temporary administrator and policy are restored and
the local packages removed with an independent receipt.

Five original captures are published without edits. The reopened Compose-root
capture shows the full team screen and recovered draft; the corresponding
system-window capture is retained only because its top is partially blank.
Before, sent, cleared and other-account system-window captures were reviewed.
The original failing draft-loss artifact is retained separately, not replaced.

This bounded local native pass does not prove physical-device reliability,
push notifications, unread state, provider networking, actual payment,
accepted release safety-audit evidence or a complete green CI run.
