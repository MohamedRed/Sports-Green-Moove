# Team Conversation Screens, 21 October 2026

Partial, local evidence. No production deployment or customer writes.

## Executed

- Three native component cases passed using an explicit in-memory team gateway:
  Messages entry, an empty scanned directory page followed by the approved team,
  320 dp width with 1.3 font scale and a long title; a failed fresh authorization
  hiding title/messages/composer; an uncertain pre-commit send followed by a retry
  using the same UUID, with two attempts and exactly one added message.
- Six separate authenticated directory service scenarios passed. These prove
  current manager-approved access for a member and independently verified parents,
  denial for an unrelated member/unenrolled manager, scoped pagination and parental
  revocation without removing the other parent's independent access. All 158
  protected baseline records and original claims were preserved.
- Eighteen message service scenarios passed again with the current page schema.
  The previous server evidence directory remains unchanged and dated separately.
- Two native unit suites contain five passing cases each: strict wire decoding
  and private timeline state, including changed admission and late responses.

The component binary is isolated (`.local`), hashes match the installed packages,
and the single-case installation restriction remained active throughout execution.
Original instrumentation, transfer receipt, setup/restoration records, eight PNGs,
four capture markers and source snapshots are retained. No screenshots are edited.

## Visual Review

The reviewed publication allowlist is in `visual-review.json`: the narrow,
access-denied and confirmed component originals, plus the uncertain-send full
window. The latter's root-only capture is a partial redraw and is **not published**.
All four full-window originals were inspected as well. Component windows do not
prove full-app system-bar/inset behavior. No video was recorded in this trial.

## Failed Preparation History

The first device disconnected during setup and was destroyed without executing
tests; its restoration was not verified. A subsequent attempt used non-isolated
APK identities and did not start instrumentation. Its device policy was restored
and its disposable environment destroyed. The new runner rejects that identity
mismatch before test preparation and retains the final cleanup path.

The next isolated attempt reported `Process crashed` before any test case. Android
exit information identifies startup ANR, not a captured application exception.
Its retained process log shows CPU and memory pressure; that does not establish
the application as the cause. Restoration was verified before destroying it.
The successful fresh device used hardware rendering, 720x1600 output and 2 GiB
guest memory, with APKs installed before the continuous guard. It is a distinct
trial, not a rerun merged into the failed transcript.

## Still Required

Connected native team discovery and two-account exchange, account/draft switching,
recreation and full-process restart, real parental revocation in the app, unread/read
state, notifications, multi-child alternative grants, other teams, physical phones
and iOS remain unverified. Component callbacks are not server delivery evidence.
No physical GPS, payment or safety-audit requirements are accepted here. Services
were destroyed and loopback endpoints verified closed after each service trial.

Reproduce service checks with `npm run test:team-conversation` and
`npm run test:team-chat-options`, each using a fresh absolute
`SGM_LOCAL_FLOW_OUTPUT`. Build local APKs with `-PSGM_USE_FIREBASE_EMULATOR=true`
before booting a fresh disposable API 35 device; use the existing continuous-device
setup with `SGM_FOCUSED_UI_CASE=team-chat-components`, then invoke
`scripts/qa/run-team-chat-components.mjs` with that setup receipt and a new output
directory. All four explicit disposable-device approvals are required. This does
not add a new physical-device or focused CI matrix acceptance requirement.
