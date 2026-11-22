# Team Enrollment Connection Recovery, 28 October 2026

One disposable physical Android phone uses the retained isolated APK from
`1518a8bdf193e99d27921699fcdcf24544b1aa2c`. The selected uploaded name is
`sgm-isolated-schedule-20261028.apk`; its known source APK SHA-256 is
`12bd492f7fe4f8360e5c0e70d18e45e633c26cf8c687a0def4451aa5b9c4666f`.
Installed bytes are not independently queried. Production Android source/build
configuration has no diff from that origin through the tested `122b27c` head.

## Observed Results

The parent signs in, selects the fixture club/team, reviews and confirms one
enrollment request through the phone UI. The app acknowledges it as pending.
After a private-connection interruption the app shows its session-restoration
error. The helper is independently confirmed terminal, with exit zero and its
private handoff directory removed; the disposable backend remains running.

A new restricted helper reconnects the same backend. The parent returns without
credential re-entry, opens owned enrollment history and sees the same pending
request. No second enrollment request is submitted. The manager refuses it using
the actual management UI and its confirmation dialog. Refreshing the phone's
history displays the refusal. Two independently persisted checkpoints pass, with
one enrollment identity, exactly two ordered events and the verified parent link.
The original session report remains **incomplete**, with two of seven phases.
The six-group preflight separately proves fixture/service cleanup, not phone UI.

The typed REST snapshots are read-only observations of the isolated Firestore
emulator. An initial unauthenticated diagnostic read returns 403; authenticated
emulator-owner reads then collect only the fixture team's documents. The saved
reader source binds that scope. Both before/after document pairs are identical.
Those comparisons establish unchanged records, not process termination.

## Restart Not Accepted

The intended full restart trial does not complete. Two provider Kill App(s)
commands are requested, but the UI continues displaying "Force killing all
processes for your apps...". No terminal acknowledgement or independent PID
measurement is obtained. The originally named `after-stop` snapshots were taken
after a button request, **not** after independently observed command completion.
They must never be promoted into successful process-restart evidence.

During navigation, Google App info is opened read-only and left without force
stop or a settings change. No Android Force stop control is used for our app.
The provider's documented control is described in its
[toolbar reference](https://www.browserstack.com/docs/app-live/get-started/toolbar);
that documentation does not prove these particular requests completed.

## Helper Lifecycle Fix

The launcher retained `--timeout 10`, which the vendor documents as ten minutes
of inactivity, not ten seconds of startup waiting. That configuration is
consistent with the idle interruption; the vendor exit supplied no causal log,
so its exact cause remains unconfirmed. The same network allowlist, inactivity
limit, logging restrictions and private credential pipes remain unchanged.

The previous lifecycle incorrectly accepted an unsolicited exit zero. It now
requires an actual owner-requested stop before accepting any shutdown outcome.
Regression tests reproduce the old false success, cover a late cancellation and
external termination, and preserve proper requested shutdown. No automatic
reconnect, credential fallback or wider network route is added. The second actual
helper exits 130 after our explicit Ctrl-C under the corrected code.
See the [vendor flag definition](https://www.browserstack.com/docs/local-testing/binary-params).

## Isolation And Disposal

Only synthetic accounts and isolated records are used. No map requests, real
payments, production writes, GPS, physical internet-loss scenario, child phone
journey, simultaneous phones, iOS or release requirement is accepted.

Fixture cleanup verifies protected records/claims. The manager signs out. Stop
Session returns to the idle dashboard, although the stale kill-progress text
remains visible there. Phone sign-out, uninstall and independent package absence
are **not** verified. The owned backend is then destroyed: its process group is
absent, all five owned ports can bind/close, and the private runtime/session and
both helper handoff directories are absent. Original interruption and incomplete
results remain preserved. No new capture or video is published; earlier galleries
retain their dates. The website receives only the scoped connection-recovery
result and keeps full restart open.

## Retained Validation

`summary.json` accepts only connection recovery and two persisted checkpoints.
`team-connection-recovery-evidence.mjs` verifies both unchanged typed-document
pairs, replays the original checkpoint assertions, checks disposal and retained
source archives, and rejects process-restart/release promotion. Every original
artifact and the summary are covered by `artifact-sha256.json`.

All 2,392 Node tests pass after disposal of the isolated backend. The portal build
and final browser checks pass at desktop/mobile sizes, including media, deep
links and overflow checks. Web Integration Smoke includes the new evidence
validator as a separate step, preserving the original workload contract. No
infrastructure change or Terraform change is required.
