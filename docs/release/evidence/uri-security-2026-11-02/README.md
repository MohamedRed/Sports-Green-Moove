# Compatible URI Security Correction

Baseline: `fbfc7e041aa3c8d086fc7ae5fadbf4c574c365d7`, 2 November 2026.
Only the existing development dependency `fast-uri` changes from 3.1.2 to 3.1.9.
Its actual schema-validator consumer already permits `^3.0.1`. Every other lock
entry and all four package declarations remain unchanged. No override, downgrade,
application workaround, fallback, provider setting or infrastructure change is added.

The maintainer documents [unvalidated port authority injection](https://github.com/fastify/fast-uri/security/advisories/GHSA-qw65-cvwx-89v3)
and [percent-encoded scheme promotion](https://github.com/fastify/fast-uri/security/advisories/GHSA-w74x-v6f9-j3xg).
The compatible patch rejects malformed ports and prevents encoded schemes from
being promoted. These are library reproductions, not a demonstrated application
exploit, customer incident or claim of production exposure.

The original `before` and `after` captures remain intact. Eight candidate assertions
fail before the patch; two still fail afterward because the first probe requires
one exact rejection form. In particular, safe equality rejection can return false,
and resolving an invalid scheme can throw its documented malformed-scheme error.
The corrected equality case also compares against the injected authority, so it
actually fails on the vulnerable consumer rather than merely requiring a throw.
That incomplete candidate is not relabeled as a passing comparison.

Both versions are then clean-installed separately and tested with identical
corrected source: all eight problematic cases fail on 3.1.2 and pass on 3.1.9.
All four ordinary controls pass on both, including real relative-reference schema
compilation. The unchanged earlier eighteen security cases also pass: the complete
corrected suite has thirty passes. Each URI probe runs in a bounded 64 MiB child,
without inherited provider credentials, with socket/fetch/lookup attempts blocked.
No network attempt occurs in these pure probes. Registry audit requests are
separate and are not described as network-free.

Source digests and archived bytes distinguish the candidate and corrected probes.
The original candidate helper is recovered from the exact edit delta and must
match the digest recorded before editing. No historical result is overwritten.

All three application builds, 623 backend units, 208 access-rule cases and 78
simulated payment cases pass. The first child-approval launch stops before fixture
creation because its required output path is absent. Its failed log/outcome and
incomplete receipt remain. The supervised child reports group exit; its separate
private configuration is subsequently removed with independently closed ports.
An explicit follow-up configures the same output contract used in CI, executes
only the two remaining service groups, and passes ten child-approval and eighteen
invitation cases. Both isolated runtimes, owned groups and private CLI configuration
are disposed. This is not parent approval or signup on a physical phone.

The audit changes from 38 findings (10 high, 28 moderate) to 37 (9 high, 28 moderate).
There are no critical findings in either snapshot. This is not a clean audit.
The pre-patch native baseline still fails its primary capture copy during
trip-consent recovery; the dependency change does not explain or repair it.
Physical tracking, actual notification/email delivery, real payments, production,
post-patch full Native CI and release readiness remain unaccepted.

The first full local Node run has two copy-contract failures after the public
blocker wording changes. The still-accurate existing wording is restored, without
relaxing either test. Both failures and the original checksum index are retained.
The final full local run passes all 3,946 cases, without skips. This does not
replace native/device/provider evidence.

Web Integration Smoke already executes both extended security test files. Only
path triggers are added for the new helper and evidence tools; all existing
commands remain unchanged. The portal adds one concise security update, without
new media, modified flow statuses, changed phone dates, tours or access policy.
