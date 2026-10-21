# Storage-Error Capture Host Correction

Native CI job `119345800372`, run `39635801559`, completed with failure at source
`eae253539b8db3fe01ece51f08ebb8b5d26b49c5`. The original JUnit XML and component
HTML are retained with artifact metadata. The read-error component case passes;
the write-error case fails with `Capture orientation does not match the tested
layout` before its final explicit-retry assertions. The suite status preserves
ordinary failure while the independent local replay returns zero. No complete
storage-error UI flow or full native suite is accepted here.

The failing host wrapped a bare composer in a 320 dp wide Box without a height.
That root shrink-wraps to the short composer, so the portrait screenshot guard
correctly rejects the resulting landscape-shaped bitmap. The production thread
fills its screen; this was a test-host mismatch, not proof of device rotation.
The host now fills the available height while retaining 320 dp width and 1.3
font scale. Orientation and nonblank-pixel capture checks remain unchanged.
Compilation and JVM tests pass, but the corrected component cases still need a
new executed UI result. No capture from this failed suite is published here.

The successful three-process connected draft trial remains a separate record
in `../team-draft-native-2026-10-21/README.md`. It does not prove every storage
failure UI branch, physical-phone behavior, notifications or release readiness.
