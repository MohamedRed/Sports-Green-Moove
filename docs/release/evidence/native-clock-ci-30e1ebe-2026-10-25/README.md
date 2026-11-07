# Native CI At 30e1ebe

Run 40215985901 is terminal failure at source
30e1ebef42cbe40b427a82d97f31c662f0961f61. All ten isolated safety jobs pass,
including the new monotonic-clock startup protocol. Its original marker, primary
copy receipt, transcript, source snapshots, restoration and host-exit receipts
are retained. One connected case verifies retained startup, device capture times
ahead/behind by a day, backend rejection of a future primary capture, and service
stop on sign-out. It is not physical GPS or a completed release scenario.

The main job reports 166 ordinary cases passed, 54 skipped, no ordinary failure.
It later fails its primary trip-change-inputs artifact copy (status 1). The copy
trace stops during file-list construction; the before/after daemon process ID
is unchanged and the recorded tail has no offline/restart signal. These bounded
observations do not establish a root cause or exclude a transport problem.
Device restoration and host exit pass, but neither rescues primary collection.
No complete main-matrix acceptance is claimed. Other old failed runs remain
separate and unchanged. Retained clock captures are internal, not new public media.
