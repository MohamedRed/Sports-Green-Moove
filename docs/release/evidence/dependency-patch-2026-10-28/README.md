# Installed Dependency Safety And Local Compatibility

28 October 2026. Baseline: `a4995ce803826b44eea9d6c5c9370aabe559a2a2`.
No production deployment, real payment, map request or physical-phone evidence.

## Reproduction And Correction

The unchanged eighteen-case dependency probe passes six cases and fails twelve
before patching. Both installed multipart encoders allow synthetic CRLF header
injection through field names and filenames. Some ID-generator non-positive-size
cases exhaust their isolated 64 MiB worker; a two-second watchdog also bounds each
probe. Random zero-size behavior is not deterministic on the original generator:
the original successful case is retained rather than rewritten as a failure.
The source-map parser accepts dangerous oversized, fractional and nested offsets.
An untrusted CSS comment reads a disposable synthetic `.map` file when `from` is
omitted. No real private file, account or credential is used.

Eight lockfile entries update within the same major and minor series, using the
maintainers' published fixes: two gRPC copies, two multipart copies, the ID
generator, CSS processor, source-map parser and build server. Root/workspace
manifest ranges and business source remain unchanged. No override, forced major
upgrade, fallback, disabled security check or transport/configuration change is
introduced. The same eighteen cases then pass. The probes demonstrate installed
library defects, not an exploit against a deployed product endpoint. In particular,
the gRPC server-certificate/error advisories are not reproduced by these probes.

## Compatibility And Remaining Findings

All 501 backend unit cases pass. Functions, admin and website build. The normal
24-group authenticated local service replay passes, including bookings, changes,
supplements, cancellation, ownership and safety invariants. Twelve separately
controlled approval/cancellation overlaps and seven installed streaming contracts
pass without changing their accepted conflict codes. Runtime directories are
removed; closed-endpoint bind checks and absence of owned-runtime process/cwd
references are independently checked after both successful launcher exits.

Audit contexts must not be mixed. The full root-workspace audit changes from
38 package findings to 33, including two remaining critical findings in tooling.
The Functions-workspace production-only audit changes from sixteen findings
(six high) to ten moderate findings (zero high). The separate root-workspace
production-only after-snapshot still has sixteen findings, including five high.
This is not a clean security audit. These registry snapshots supersede neither
the older dated parser audit nor future database changes.

The original eighteen test names, both full locks, registry reports, local service
receipts, compile/unit output and source hashes are retained. Web Integration
Smoke runs the new regression and evidence validators. No Terraform change is
needed. Existing phone captures remain dated; publish concise text only and
preserve the public progress-site audience.

## Independent Negative Control

The baseline's focused chat-network job fails at network preparation before a
disconnect. Its original marker, instrumentation result and device restoration
are retained separately under `previous-ci/`. Default connectivity is cellular
while both Wi-Fi and cellular networks are present. This neither proves a product
defect nor identifies why default selection did not satisfy the preparation
contract. The terminal main run also retains one blank-capture failure and an
incomplete primary trip-consent-recovery copy. The dependency patch is not
accepted as a repair of these failures.

## Maintainer Sources

- [Multipart metadata escaping](https://github.com/form-data/form-data/security/advisories/GHSA-hmw2-7cc7-3qxx).
- [ID-generator size handling](https://github.com/ai/nanoid/blob/3.3.18/index.cjs).
- [Source-map offset validation](https://github.com/7rulnik/source-map-js/commit/cf76580).
- [CSS map-file disclosure fix](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp).
- [gRPC certificate advisory](https://github.com/advisories/GHSA-m9gg-hp2v-232j).
- [gRPC error-detail advisory](https://github.com/advisories/GHSA-f596-whhp-79r4).

Validation: `node --test tests/dependency-security-contract.test.mjs tests/dependency-patch-evidence.test.mjs`.

## Final Publication Checks

The initial full Node run passes 2507/2510: three assertions still require the old
latest-news/blocker source or previous workflow command. Their corrected checks
retain the historical proof and verify the new scoped results. The full recheck
passes 2510/2510. Final focused checks also replay all eighteen dependency cases
and immutable evidence. Browser QA passes at 1440, 768, 390 and 320 pixels with
existing videos/galleries unchanged. The two new public notes are shortened after
the full browser pass and rechecked separately. No new media is published.
