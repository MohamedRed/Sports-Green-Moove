# Full native job interrupted by its outer budget

Job 124201947063 in run 41096043272 on
`9abc639369a9d2a40a7917a578a981c7d5953ce6` ended cancelled after 2114 seconds.
Its check annotation explicitly reports exceeding the 35-minute job limit.
The retained original workflow defines that limit. SDK setup took 387 seconds,
compilation 358 seconds and all preparation before the UI action 796 seconds.

The ordinary instrumentation transcript independently parses to 205 passed,
54 skipped and zero failed cases. Ten retained primary copies completed, but
the archive has no final replay result, native-suite status or restoration
receipt. Neither completion of the 37 integrated groups nor independent cleanup
is accepted. The whole gate is incomplete, not a successful run with missing
screenshots. Original 24 MB downloaded evidence remains privately retained; this
bundle includes its filename/hash inventory and the relevant original records.

Artifact 12998077871 is `android-connected-ui-test-results`, with provider digest
`sha256:3d541f4ee24ed5c1cdf6beb3c50e6cdd859bd93ec1f63bdef276fbdaacfa4599`.
Raw job-log downloads failed twice; no invented log or exit reason replaces the
actual check annotation. Existing passing and failed trials stay separate.

## Budget Change

Only the enclosing native job limit changes from 35 to 50 minutes. Compilation,
all ordinary/integrated cases, one continuous test phone, network deadlines,
capture thresholds, primary-copy requirements and cleanup remain unchanged.
The earlier ef8b998 main job finished its UI action in 1111 seconds, with only
eight seconds of SDK setup. The interrupted trial spent over thirteen minutes
before that action, leaving under twenty-two minutes for execution and cleanup.
The new fixed limit provides preparation and reporting headroom; it does not
accept any prior interruption or prove the next full run will pass.

A separate build-job/APK-transfer candidate was unit-tested with synthetic files then removed
before commit or upload: this repository is public, so shipping the ordinary APK
as a new CI artifact would unnecessarily expose distributable client config.
No APK artifact, new credential, infrastructure, paid map request or alternate
test path was introduced. The original 111 web workload fingerprints remain
unchanged; existing web/native coverage runs the expanded build-before-boot test.
The intentionally disabled iOS jobs stay disabled.

## Separate Later Success

The later `13767b4da15aeebc180cf5471808103c6a1f1bc6` run 41100104923 passes the
complete native gate and all eleven independent jobs. Main job 124215726597
finishes in 32m48s, with 205 ordinary passes/54 skips, 37 integrated groups/40
native cases, seventeen primary copies and verified test-device restoration.
The retained suite exit statuses are all zero. Matching backend/web/readiness
checks are successful, with approved map and iOS jobs intentionally skipped.
Artifact 13001096037 has digest
`sha256:d3ef7c89055bbb036b42650ccb132b4151f14a0ce1a5dfa9158cc7a6f03804ea`.

This success still used the original 35-minute limit and is not attributed to
the proposed 50-minute budget. It does not establish the preceding timing,
transport or renderer issues' underlying cause. The cancelled trial and its
unverified cleanup remain negative evidence. No physical, payment or release
evidence is promoted by the complete automated gate.

Publish one short local complete-run note, without new media or flow promotion.
Keep Messages partial, its successful independent chat repeat and all historical
gallery dates. Real tracking, payments, emergency dialer, urgent email and the
other release requirements remain open.
