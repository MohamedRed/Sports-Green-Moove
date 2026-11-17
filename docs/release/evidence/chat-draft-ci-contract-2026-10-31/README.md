# Draft Persistence: Current-Head CI Failures

At source `86746f4`, focused chat-network job `124659032314` of run
`41242479843` fails its final parent-return assertion at line 162. The driver
has already been verified to have an empty draft. After the parent's return,
the test expects an empty string but observes its own unsent private draft.
The original instrumentation transcript is retained unchanged. The new durable
draft behavior intentionally restores that owner's draft; it must not expose
it to the driver.

The candidate updates that final assertion to the exact private draft and adds
versioned `parentDraftRestored` evidence. The fresh verifier requires the new
version; historical receipts retain their original narrower contracts. Existing
offline failure, explicit retry, duplicate/read/notification checks, driver-empty
assertion and cleanup remain unchanged. Targeted Node checks pass and Android
instrumentation compilation succeeds. Execution of the updated full network
case is not yet verified; this is not a radio, delivery or UI-replay acceptance.

The separate session-restoration job `124659032291` fails at the existing
60-second Home-screen wait after explicit Retry (line 83). Its proxy records
two intentional 503 rejections followed by an authenticated successful upstream
and downstream 200. That does not prove the app rendered Home or reveal why it
did not. Retain this failure as unexplained and unrepaired. The original
instrumentation and proxy receipt are retained; the prior passing runs remain
historical. No deadline is extended and no automatic retry is added.

The main native job was still running when these failures were inspected. Its
eventual outcome must be checked separately. These selected artifacts were
downloaded through the existing repository account from that exact run, not
regenerated locally. No complete original archive digest is claimed.
