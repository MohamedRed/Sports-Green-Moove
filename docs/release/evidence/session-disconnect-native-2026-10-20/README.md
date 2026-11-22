# Explicit Disconnect After Restoration Failure

Actual local SDK/app execution passed on 20 October 2026. Source:
`62eef1c4df7ebb96bc98ab357b2783901fb89b7a`, Native CI run `39420260518`,
completed successful job `118619147999`. This accepts this one focused trial,
not the entire still-running workflow or a physical-device release requirement.

The first method signed in the isolated synthetic parent, then rejected exactly
one restoration callable with a controlled 503. The real error screen kept the
parent signed in and exposed Retry and Disconnect without the private error
detail. Pressing the actual Disconnect action opened login and cleared the SDK
identity. The success checkpoint was written before test cleanup.

After the first instrumentation exited, the host observed no running app process,
issued the guarded force-stop for the exact isolated package and again confirmed
no process. It did not clear data or reinstall anything between methods. The
second method ran in PID 5247 rather than 4919, found the SDK already signed out
before opening MainActivity, then verified login and no Home/restoration error.
Both raw transcripts contain one executed passing case. The two login captures
are intentionally byte-identical: distinct transcripts, PIDs and the stop receipt
establish the relaunch, not an invented visual difference.

All three original captures were visually reviewed and are published unaltered
inside the app frame. Social sign-in labels and the old promotional footer are
existing app content, not newly verified social sign-in or usage claims.

The mandatory primary transfer passed. Five test-account claims, all 13 top-level
fixture collections and live trips were unchanged except the selected parent's
expected profile timestamp. Proxy/admin connections closed, both local APKs were
removed, the owned runtime was destroyed, its CLI exited cleanly and four local
endpoints closed. The outer device receipt independently verifies the continuous
installation guard and restoration of background/launcher/store settings, removal
of the administrator and its helper, and package cleanup. A running store service
does not contradict the retained continuous installation restriction.

`artifact-sha256.json` binds 19 original/context files. The 29 source bindings were
matched to Git at the source commit and retained in `source-archive/`. The artifact
metadata records provider digest
`sha256:402b02d3a9f1df7d67ac98e7c14cab472c7dd54959e33df021a6eeeeaa913e9a`;
individual original-file digests were independently checked. This is not a
locally recomputed ZIP attestation.

No real network outage, physical GPS, active-ride restart, child-own-account login,
payment, provider, store-review or safety-audit acceptance follows from this run.
Production accounts/data were not used. The original four-step Retry/rotation
trial remains separate and unchanged.
