# Local TLS Agent Security Check

Base source: `199307ab6128a3bada97a2471d154c550bec71ae`.
Only the development CLI transport package changes, from Undici 6.26.0 to 6.29.1,
within both existing consumers' declared compatible ranges. Every other lock
entry, dependency declaration and runtime source is unchanged. No override,
certificate-validation bypass, fallback, provider setting or Terraform change is
introduced. The unused vulnerable installed package is replaced, not retained.

## Reproduction

The original installed CLI-resolved Agent performs a real TLS handshake against
an ephemeral loopback HTTPS server with a freshly generated synthetic certificate.
The certificate is explicitly trusted only for the two custom-verification cases.
Both fail: the allow callback is never invoked, and a callback intended to reject
the trusted certificate is ignored, allowing an HTTP request. The ordinary
untrusted-certificate rejection passes. This reproduces the dependency behavior,
not an exploit against our production app or an actual user account.

With the maintained patch the same three unchanged tests pass: the custom allow
callback runs once, custom rejection blocks HTTP entirely, and an untrusted
certificate remains rejected. Each child has a bounded timeout/heap and omits
credentials from its environment. No external endpoint, private account, real
certificate or money is used. Generated keys/certificates are removed; each
successful probe independently confirms its loopback listener is closed.

The all-workspace audit moves from 30 findings to 29: eleven high and eighteen
moderate, no critical. Undici disappears from that snapshot. Other dependency
findings remain; this is not a clean audit or full security certification. Other
patch fixes are included but are not individually reproduced by these three cases.

## Compatibility And Limits

A normal clean install, all three workspace builds, 547 Functions tests, 208
permission/rule tests, 78 payment/webhook tests and 19 notification-read tests
pass. These use isolated local fixtures or mocked provider boundaries, not real
payments or actual provider delivery. Java 21 is selected explicitly. All eight
local emulator/service listeners are independently closed after the runs.

Before/after locks, audit snapshots, unchanged test sources, exact failing and
passing output, compatibility output and closure receipt are retained by SHA-256.
The separate base-source native team-read lane, job `124330865782` in run
`41133722663`, is terminal failure: emulator boot completes, then the unlock
`input keyevent 82` command exits 255 before the configured test script begins.
Its terminal job record and narrow original log excerpt are retained. This update
does not diagnose or repair that preparation failure, nor accept the full native
gate, real phones, physical GPS, production or overall release readiness.

Web Integration Smoke and Native CI explicitly execute the TLS regressions and
evidence checks. All 111 original smoke workloads retain their commands and
environments. The public site gets one short progress note without new media,
technology names, changed statuses or changed audience. Earlier evidence remains.

## Maintainer Sources

- [Custom TLS verification lost by Agent](https://github.com/nodejs/undici/security/advisories/GHSA-2m5v-pch6-74hx).
- [Maintained compatible 6.29.1 release](https://github.com/nodejs/undici/releases/tag/v6.29.1).
