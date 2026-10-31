# Runtime Proxy Trust Regression

Verified locally on 19 October 2026 against the dependencies resolved by
`firebase-functions`, not a standalone replacement or mocked trust implementation.

## Reproduction And Correction

The installed dependency path is `firebase-functions` -> Express -> `proxy-addr`.
`proxy-addr` 2.0.7 accepted IPv4 peers under improperly scoped IPv6 trust prefixes.
The [maintainer advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h)
identifies 2.0.8 as the patched release.

The four cases in `tests/proxy-trust-security.test.mjs` exercise:

- Public/loopback IPv4 peers under a short IPv4-mapped IPv6 trust prefix.
- An IPv4 peer under a native IPv6 trust prefix, with a valid IPv6 control.
- Correctly scoped mapped and ordinary IPv4 prefixes, including trusted controls.
- A real loopback HTTP request through the server's resolved Express dependency,
  carrying a forged `X-Forwarded-For` header.

`before.tap` retains the original run: three failures, one passing control.
The HTTP case returned the forged address. After the compatible update,
`after.tap` retains four passes and the HTTP case returns the actual loopback peer
with no forwarded chain. No internet listener or production request was used.

Only `node_modules/proxy-addr` changes version in the lockfile, from 2.0.7 to
2.0.8. Both existing Express constraints permit this patch; no overrides,
fallbacks, application trust configuration or unrelated versions are changed.
Backend CI and Web Integration Smoke now execute the behavioral regression.

## Regression Checks

- Root Node tests: 623 passed, zero failures or skips.
- Functions tests: 46 files / 304 tests passed.
- Functions, admin and public website production builds passed. The admin build
  retains its existing large-chunk warning; this change does not address it.
- Fresh `npm audit --json`: `proxy-addr` is no longer reported. The snapshot still
  reports 52 other advisories (24 moderate, 25 high, three critical). The remaining
  critical entries are `tar`, `tinypool` and `vitest`; their root dependency paths
  are development tooling. This does not establish their exploitability or waive
  the rest of the audit. No forced major upgrade was applied.

## Boundaries

This proves the dependency defect and patch with a deliberately unsafe synthetic
trust configuration. No matching custom `trust proxy`, IP-based authorization or
forwarded-header policy was found in `functions/src`; these tests do not prove a
production exploit occurred or was reachable. Production is not deployed by this
task. Other dependency advisories, live-provider, payment, physical-device and
complete native-matrix requirements remain open. No release evidence is accepted
by these four local cases.

## SHA-256

| File | SHA-256 |
| --- | --- |
| `before.tap` | `ec99a44f58f0e39fbfcc1e3fb983f0a08b25e458ec21eeb2fe3f63da66710fc8` |
| `after.tap` | `7e19fcfe3afe55d79e246ee1e9aae1afa625c7f0cb7f752b600815bba66437be` |
| `tests/proxy-trust-security.test.mjs` | `3b2916ed5dc68092b2a1fd2b60566ef9974c8277c91a850696f7288d7914bf8e` |
| `package-lock.json` | `bea6996c28c55df5ed74f2051d6781766bff726d5fe950c1cf6bb335a18352e9` |
