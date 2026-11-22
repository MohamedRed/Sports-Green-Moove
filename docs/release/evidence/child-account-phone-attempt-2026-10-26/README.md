# Child Account Phone Attempts, 26 October 2026

Two disposable App Live Pixel 9 Pro / Android 15 sessions used the isolated
`demo-sgm-local-qa` fixture and the unchanged application source at
`15dd2e382832f829ac3f1292763dc0afaef6c32d`. The local APK SHA-256 is
`fcd017b8bef76c38c9e5cc19cef31a1d28d252a5289d14a032bdeb3f00e1d2ee`.
No production writes, map requests, payments or account-role escalation occurred.
The child login was provisioned by the fixture, not created through signup UI.

Both attempts observed child sign-in, app-generated code creation, sequential
parent sign-in, verified-child selection and the empty parent approval form.
Their independent read-only observers each passed the first three of six ordered
checkpoints, with unrelated records, claims and live data unchanged at those
checkpoints. Neither observer completed approval, child return or final sign-out.

The first attempt had incomplete remote code input and the dialog closed before
approval. In the second attempt, native inspection found 31 of the 32 entered
hexadecimal characters; an attempted cursor correction and submission did not
produce an observed link. The two supplemental read-only link-count queries
returned zero. Their terminal outputs were not retained as standalone reports,
so they are not promoted to final saved-state evidence. These input/navigation
problems do not establish a production application defect or an expired-code
rejection. No completed pairing, permission-denied contact, dialer, GPS, outdoor,
two-device, iOS, signup or release-readiness claim is accepted.

Only generated observer summaries, fixture readiness receipts and runtime
cleanup receipts are retained. Baseline/checkpoint snapshots remain private;
passwords, pairing codes, clipboard data and inspector output are not published.
Source files are retained by checksum under `source-archive`.

Both observers closed Firestore and Admin clients. Both owned fixture process
groups exited; their private session files and temporary runtimes were removed
and all four loopback endpoints closed. Both owned tunnel process groups exited
and removed their private handoff directories. The second tunnel initially
exited with code 127 before the approved startup-diagnostic retry; no root cause
is inferred. That retry did not enable request logging or broaden the allowlist.

The first phone acknowledged app uninstallation. The second removal control
reported no user apps found; independent package absence is not proven. Both
sessions returned to the dashboard. No device policy was changed. Whole-flow
sign-out and package absence are not claimed as completed checkpoints.

## Reviewed Media

- `captures/child-before-code.png`: first attempt, child dialog before creating
  its code. No code or password is visible.
- `captures/parent-review.png`: second attempt, parent review with Lina QA and an
  empty code input. No completed approval is implied.

These are original unscaled browser-viewport device rectangles, 254 x 522 pixels,
not native-resolution exports or video. Both are legible and unobstructed at the
dialog controls. Older 19 October simulated screenshots remain dated separately.
