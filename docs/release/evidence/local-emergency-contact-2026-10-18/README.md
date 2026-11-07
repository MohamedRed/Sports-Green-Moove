# Private Contact Service Checks

Actual isolated HTTP run `751957def42330a8e998c6cd6f7baf3a`, completed
2026-10-18 at 17:27:34.959 UTC. `services.json` is the original generated report.
SHA-256: `64e837db11ddd8743cc89263311fbad1dfa6cedf19c4cd2378ece897ba51ac17`.

Sixteen service groups passed using newly seeded accounts in
`demo-sgm-local-qa`, without cloud credentials or provider access. Scenarios
exercise callable HTTP endpoints and direct Firestore REST requests against
the actual rules, not a successful fake gateway.

Covered: strict contact/identity validation, adult account isolation,
save/reload, same-operation recovery, conflicting edits, revisioned removal,
stale replay, pending/refused/unverified parents, manager verification,
revocation, removed relationships, inactive memberships, archived clubs,
foreign tuples, concurrent revocation, direct read/query/write denials even
for admin, malformed data and contact privacy outside the private collection.

The report contains no contact names, numbers, passwords or tokens. The two
synthetic phone values in the test source use the reserved fictional 555-01xx
range. They were stored only in the disposable emulator and were never dialed.

This is **not** an app-screen replay, dialer handoff, physical-device test,
production deployment, connected call or active-ride access test. No emergency
screen captures are accepted. Adult/child editing screens, account-switch and
interruption behavior in the app, the ride entry point and device handoff remain
to implement and verify. All physical tracking and safety-audit gaps remain.

Reproduce with Node 22, Java 21 and existing dependencies:

```sh
npm run test:emergency-contact
```

The initial launch stopped before scenarios because the shell selected an older
Java binary despite `JAVA_HOME`. The accepted run explicitly put Java 21 on
`PATH`; there was no provider fallback, increased deadline or automatic retry.
