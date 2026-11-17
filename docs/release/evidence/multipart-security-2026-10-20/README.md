# Runtime Multipart Security Regression

Verified locally on 20 October 2026 using the multipart dependency resolved from
the Functions workspace's installed `firebase-admin`, not an independent parser.
The SDK uses `@fastify/busboy.Dicer` in its HTTP multipart response path
(`firebase-admin/lib/utils/api-request.js`, `handleMultipartResponse`).

## Reproduction And Fix

The original resolved version was `@fastify/busboy` 3.2.0. Maintainer advisories
identify three defects:

- [Prototype-named headers](https://github.com/fastify/busboy/security/advisories/GHSA-x8mw-p69m-v3mx):
  part headers named `__proto__` or `constructor` cause a parser exception.
- [Oversized boundary search](https://github.com/fastify/busboy/security/advisories/GHSA-xjh9-v7x6-24jw):
  a 252-byte boundary can cause a zero-distance search loop.
- [CR/LF disposition parameters](https://github.com/fastify/busboy/security/advisories/GHSA-gxm5-99cw-xjw9):
  bare CR or LF can reach the application's filename or field name.

`before.tap` retains ten behavioral cases: three controls pass and seven fail.
Both prototype headers throw, the 252-byte boundary with a synthetic preamble
exceeds the parent process's five-second limit and is killed, and four disposition
cases deliver a bare CR or LF. The normal field/file and 70/251-byte boundary
controls pass. The timeout is a negative result, not an accepted parser outcome.

The unchanged tests then pass all ten cases in `after.tap` with 3.2.3. Only that
package's version, archive and integrity change in `package-lock.json`. Its existing
`firebase-admin` dependency constraint `^3.0.0` permits this patch. No application
fallback, major upgrade, override or unrelated dependency change is introduced.
The corrected parser ignores malformed disposition headers instead of passing
their control characters to the field/file callback; the normal control still
returns both its field and its file intact.

Each hostile probe runs in its own child process with a hard kill timeout, bounded
output and synthetic in-memory input. No account credentials are supplied to the
parser, no network listener is created and no production request is made. Parser
errors are captured as negative evidence rather than
crashing the entire test suite. Backend CI and Web Integration Smoke run the
regression; the smoke path filter covers the test and its probe helper.

## Broader Checks

- Root Node suite: 944 passing tests, no failures, cancellations or skips.
- Functions: 52 files / 366 passing tests.
- Functions, admin and public website builds pass. The existing admin chunk-size
  warning remains; this patch does not address it.
- Fresh `npm audit --omit=dev --json` snapshots are retained. This package's three
  advisories disappear; remaining affected-package entries change from 23
  (13 moderate, ten high) to 22 (13 moderate, nine high). Other advisories remain.
  Package counts are not counts of reachable production exploits. Some entries in
  this workspace audit describe build dependencies declared as production ones.

## Boundaries

These tests establish the installed dependency defects and compatible correction.
They do not exercise the SDK's full HTTP client against a live provider, prove
that an attacker could supply such responses in production, or show that any
production exploit occurred. The CR/LF cases use the dependency's form parser;
the Admin SDK's observed HTTP path uses its lower-level Dicer instead. No custom
multipart upload endpoint or forwarding sink is introduced by this change.

The application backend is not deployed. Physical tracking, real payments,
safety-audit exports, child-own-account access and store review remain open.
Earlier proxy-trust evidence and unrelated negative native evidence are preserved.
No Terraform resources or real account data changed.

## SHA-256

| File | SHA-256 |
| --- | --- |
| `before.tap` | `51e34e1ed44323da2680e902b8a184857ceec5c0835b06144df2205b01204674` |
| `after.tap` | `d249e21ea864180c8fb71750f60f56ea61a1a6a0cdecaffcd16d2e5a62b4dfb4` |
| `audit-before.json` | `46f52e1d43d6070c4c2e76e0d509cae9a0bdc1f15314143c90953151b63c0b22` |
| `audit-after.json` | `006c1c106fb492d145e01448460a0474c2aeb8093811d08b119de471e8799006` |
| `tests/multipart-security.test.mjs` | `0321be59cd803a1b979f08546518f0222791276697b2a7a79ce70de5f0206951` |
| `tests/helpers/multipart-security-probe.mjs` | `9ca8439fcedbd92ffbb233f1362c1a00641766d8f5a6c2aaee7b132e0ef6ed17` |
| `package-lock.json` | `78315160953a7b78cfe6d043072b897a594fd2bf66af45bbeb8b308e16fbad09` |
