# Exact Publication Prices, 5 November 2026

Baseline application source: `85ec9e9274344eefaf7ce63eef36869a22da3489`.
No phone, map, payment, account or provider request is made by these checks.

## Reproduced Defects

The exact old iPhone parser is compiled and executed in separate processes.
`0.29` yields 28 cents. Invalid text, negatives and excess fractional digits can
become zero; exponent notation is accepted. `NaN`, `Infinity` and `1e300` terminate
with SIGTRAP during conversion to Int. All eleven probe outcomes are retained in
`swift-baseline.json`, including crashes, rather than converting them into passes.

The actual Android draft factory, with the new regression assertions and unchanged
baseline production logic, fails one of four JVM cases: `invalid` produces a
complete draft with `priceCents=0` instead of being rejected. The test stops at
that first malformed input; it does not prove execution of every later input on
the old implementation. `android-baseline.json` retains that original failure.

## Correction And Recheck

iPhone uses strict full-input syntax and Foundation Decimal before bounded
integer conversion. Android reuses the existing strict BigDecimal edit-price
logic through a shared parser. Both reject malformed, nonfinite, exponent,
negative, over-precision and over-limit inputs. The existing backend range of
0 through 100000 cents is unchanged. No commission policy is selected.

Both publication screens validate before advancing and again before publishing;
the Android draft factory independently rejects invalid prices. Confirmation
summaries format the same validated cents, including explicit invalid-price text
instead of a free-price substitution. Empty or whitespace-only publication input
retains its established free-trip meaning. Editing still requires an explicit
price. The superseded floating-point publication parsers are removed.

Actual Swift and Kotlin checks each round-trip all 100001 permitted cent values.
Swift additionally verifies thirteen labels/accepted inputs and twenty-one
malformed inputs; Kotlin tests invalid factory inputs, labels and unchanged edit
semantics. The complete controlled native plan passes. All 846 Android JVM cases
in 120 suites pass without skips or failures. Sanitized structured JVM reports,
native output, exact source archives and checksums are retained alongside this
file. `check-publication-price.mjs` runs the actual Swift model and assertions on
its own; Web Integration Smoke adds this check without removing any workload.

These results do not accept current native screens, real-device publication,
club/team authorization, physical tracking, operational evidence or release.
The eleven iPhone UI cases, 50-minute limit and optional capture bounds remain
unchanged. Prior public flow statuses, dates, media, tours, notes, blockers and
access are preserved. `portal-before.json` hashes those preceding records.
