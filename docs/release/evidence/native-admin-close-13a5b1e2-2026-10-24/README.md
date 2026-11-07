# Completed isolated native replay and client closure - 24 October 2026

Native CI run 40045976904 succeeds at source 13a5b1e2. The main job completes
normally, without extending its 35-minute deadline. Its aggregate has 37 passed
steps / 40 native cases, including notification read recovery after process
death. All 32 instrumentation transcripts and 17 primary transfer receipts pass.
Ordinary components: 159 passes, 52 intentional skips, no failures or errors.
All ten separate focused lanes and their aggregation job also succeed.

The final aggregate is written after awaited Firestore termination and Admin
app deletion, and explicitly records both acknowledgements. The local script
exits zero; emulator services shut down. Device restoration verifies package,
launcher, background state and temporary installation-administration cleanup.
The independent host observation finishes with the emulator process gone.

The prior timeout and controlled unclosed-client regression remain in the
separate admin-client-lifecycle bundle. This completed replay closes that
specific blocker; it does not diagnose earlier device transport or startup
failures. The watch command itself encountered a local socket error, so its
exit status is not used as a workflow conclusion. Fresh GitHub run/job data,
the matching artifact and its successful terminal log establish this result.

The retained native subset includes the aggregate, every instrumentation
transcript and primary-copy receipt. This recheck does not independently repeat
every domain/state verifier against its destroyed backend or publish new media.
Existing gallery captures keep their original dates. This is local isolated
Android execution, not physical GPS, live maps, payments, push, iOS or release
acceptance. The later validation-dependency update is separately checked in
its own bundle; it is not included in this source commit's native execution.
