# Stale Cancellation Preview on a Physical Android Phone

Tested 30 October 2026 on one Google Pixel 9 Pro / Android 15 through App Live,
using disposable accounts and isolated local records. No production writes,
map requests, real payments, or calls. This is a sequential stale-preview test,
not simultaneous transaction contention or a two-phone exchange.

## Observed Result

All eight independent stored-state checkpoints pass. The driver opens revision
R0 of the cancellation review, with one approved two-seat child booking and one
pending one-seat booking. A separate authenticated driver SDK session approves
the pending booking once. Availability changes from two seats to one, creating
revision R1. This peer action is not phone UI evidence.

The phone refuses confirmation against R0 with: "Annulation non confirmée.
Actualisez le trajet avant de réessayer." The independently read state still
equals the peer-approved state: no cancellation receipt or cancellation writes.
Refreshing warns that reservations have changed, retains the exact reason
`Entrainement reporte pour cet essai`, and obtains R1. Only the phone submits the
cancellation. Explicit confirmation then creates one R1 receipt, cancels the
two active bookings, returns three reserved seats (one to four available), and
creates one cancellation notice per parent. Notices are verified stored
records, not peer phone displays or push delivery. The driver history shows
the cancelled trip and four available seats. The older closed booking,
unrelated records, roles/claims and live tracking remain unchanged.

`records/observed-*-checkpoint.json` retains the independent observation before
each assertion. `records/session-results.json` records all eight completed
phases and closed SDK clients. `summary.json`, exact source archives and
`artifact-sha256.json` bind the observations without overwriting earlier runs.
The older fixed two-seat cancellation protocol remains strict; this separate
case validates three returned seats against the actual peer-approved capacity.

## App and Source

The selected local QA APK is `sgm-support-phone-a1d0d96.apk`, SHA-256
`3837331ce85b2cddadc39145f6ae2713f504ac590114a7c97d89763a3adc6642`.
Its package is `be.sportgreenmoove.app.local`; its isolated endpoints and actual
fixture calls were checked. Android app sources have no difference from
`a1d0d96` to the tested `dcd7a5e` baseline. This does not independently hash the
installed device bytes. `baseline-ci.json` is terminal CI for `dcd7a5e`, not CI
for the subsequently added helper, portal or evidence code. All baseline checks
finish success/skipped after one unchanged failed-job rerun: the first release
provider attempt timed out at the callback host. That timeout remains a real
failed attempt; no callback root-cause repair is claimed.

## Captures and Preparation Limitations

Five public images are unscaled 254 x 564 phone crops of retained 1440 x 722
session-window JPEGs, with exact rectangle and hashes in each capture manifest.
They are session captures, not native screenshot exports. Original frames and
non-public checkpoints remain retained. No video was recorded.

Remote text entry initially altered synthetic login text and the reason. Exact
clipboard paste corrected them before the accepted preview/peer mutation; no
product authentication defect or wrong-reason cancellation is established.
No password-entry screenshots, passwords or access keys are retained here.
The first `signed-out` frame still shows the profile and is explicitly rejected
as sign-out evidence. The later `signed-out-confirmed` frame shows empty login
fields and is the accepted UI observation.

## Disposal and Remaining Scope

The driver signed out. App Live acknowledged uninstall and displayed device
home. Independent installed-package absence could not be checked because the
device tools were disabled; it is not claimed. Stop Session returned to Uploaded
Apps, with no active stop-session control. The owned phone and private-input
tabs were closed; existing user tabs were left open. No device administration,
installation policy or store setting was changed.

The one-use loopback input delivered a credential only to the existing owner-only
FIFO, cleared its field and closed. The key was not placed in regular files,
arguments, environment, diagnostic output or clipboard. The signed connection
helper retained the existing exact four-port allowlist and was stopped. Both
owned process groups exited; temporary handoff/runtime/session data are absent,
the host clipboard was restored, and all five owned listeners are closed.
`disposal.json` records these host checks and the scope of the reviewed provider
acknowledgments; it does not invent independent package removal.

Still unproven: simultaneous locked transaction overlap, two phones, peer phone
UI, the wire-level ABORTED code, remote push, real refunds/payments, physical GPS,
iOS and release completion. Earlier cancellation/restart/parent phone evidence
and failed native transfers remain separate and unchanged.

The earlier controlled transaction-conflict results remain in
`docs/release/evidence/local-trip-contention-2026-10-17/README.md`, including the
original service failure retained at
`docs/release/evidence/local-session-restoration-2026-10-16/screen-recheck/README.md`.
This later sequential phone trial does not replace those failures, repeat their
transaction-lock setup, or extend their root-cause conclusions to phone behavior.

Validation: `node --test tests/cancellation-stale-phone.test.mjs`.
