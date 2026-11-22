# Completed Local Replay, Failed Ordinary Capture

Source commit: `24218efd46fa35c5d64e7d33dd07f28657fc4fa3`.
GitHub run: `39759370885`; retained artifact: `12418273134`.

The actual terminal run is failed. The original ordinary XML lists 193 cases,
including 50 skipped cases and one failure:
`TripChangeFlowTest.largeTextParentSeesBothVersionsAndAcceptsWithoutApplying`
times out waiting for PixelCopy. No retry, replacement screenshot or timeout
increase converts that failure into success. Its underlying cause is not proven.
The full original XML preserves the failed case and skipped cases. The Gradle
log's different aggregate count is not used as an executed-case count.

The separate local replay does finish: 36 groups, 38 native cases, 30 original
instrumentation transcripts and all 16 mandatory evidence copies pass. The
unchanged result, original captures, copy receipts and source bytes remain under
`replay/` and `source/`. Eleven focused lanes also finish successfully. Device
restoration verifies removal of temporary administration and the test component.

The suite-status receipt remains ordinary=1, component=0, replay=0. Passing replay
and focused lanes do not establish a green overall Android job or repair the
ordinary capture failure. Earlier transport failures remain unchanged in their
dated bundles. No new local capture from this bundle is published in the portal.
This evidence does not accept physical tracking, payment or release requirements.
