# Compatible Security Patches

Twelve generated lock entries change within their existing dependency ranges.
No direct manifest, Firebase version, gRPC version, application source, retry,
timeout or provider configuration changes. The audit's proposed Firebase/rules
downgrades are not applied. Both complete lock snapshots and audit responses are
retained; the baseline lock is from `e255fe9083d4cda1d7c022512f0864e120bc73cf`.

The four updated dependency families are the MCP TypeScript SDK, brace-expansion,
Browserslist and ip-address. Their maintainers publish patched versions in the
[MCP task-session advisory](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-22jm-h49p-29qw),
[brace parser advisory](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr),
[Browserslist cache advisory](https://github.com/browserslist/browserslist/security/advisories/GHSA-c83g-rgw3-j3cx)
and [IP parser advisory](https://github.com/beaugunderson/ip-address/security/advisories/GHSA-rxp7-6hxx-x8q5).
Browserslist's five data/helper dependencies update with it. Both brace-expansion
major lines stay on their original major line. There are no overrides or forced
major updates.

The installed whole-workspace audit changes from 37 findings (9 high, 28 moderate)
to 32 (5 high, 27 moderate), with zero critical in both. The five remaining high
entries are the Firebase/Firestore/rules/gRPC chain. This is not a security
clearance or proof that an exploitable production route exists for every finding.

A pure parser comparison independently reloads ip-address 10.2.0 from an archive
matching the baseline lock integrity and compares it with installed 10.7.5.
The old parser misclassifies `fea0::1` as not link-local and accepts a leading-zero
IPv4 spelling as decimal. The updated parser classifies that address as link-local
and rejects the ambiguous spelling. Ordinary IPv4/IPv6 normalization is preserved.
The older code runs only in this isolated comparison, never as an app fallback.
No network exploit, real request, OAuth exchange or production attack is tested.

All three workspaces build and all 623 backend unit cases pass. The connected
invitation service suite passes all 18 steps using only `demo-sgm-local-qa`, with
zero provider requests and no browser/native/physical UI acceptance. Its owned
environment is destroyed and all four endpoints close. These checks do not finish
the separately pending parent-approval phone trial.

The baseline main Android job passes, but its focused disconnect and network
jobs fail and their aggregator fails. The network attempt stops before any cut,
with no default mobile-data subscription available; the disconnect job stops
during device preparation. The main pass does not erase these failures, and the
dependency patches are not their demonstrated cause or repair. Keep this complete
baseline rollup separate from the new commit's later CI checks.

The public portal adds one short security update and a non-visible evidence
reference. All 34 flows, phone dates, media, tours, partial statuses and earlier
updates remain unchanged. No new app capture or release acceptance is added.
Web Integration Smoke runs the new contracts through its existing dependency
evidence command and includes the new module in both path filters. No Terraform
change or production deployment is involved.

The Node suite passes 4,197 cases with the updated dependencies. The first
payment-publication assertion rejects the extra dated update (398 versus 397).
Its scope is corrected using the exact previously published v331 payload, bound
to its independently verified SHA256. The original v330-to-v331 comparison stays
intact, and every historical update must still appear unchanged and in order;
only later entries may be appended. This does not change any app test or deadline.
