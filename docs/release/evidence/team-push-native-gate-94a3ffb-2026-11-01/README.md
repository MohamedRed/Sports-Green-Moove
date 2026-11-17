# Full Native Gate at 94a3ffb, 1 November 2026

Native CI run 41314916070 is terminal **failure**. Its complete ordinary inventory
contains 286 cases: 230 passed, 54 intentional skips and two failures. Both failures
are in `TripChangeFlowTest`, at `captureToImage` while waiting for PixelCopy:

- `agreementStillRequiresRouteAndApplicationAndDoesNotClaimSettlement`
- `largeTextReviewKeepsCloseVisibleAfterScrollingToTheDecision`

The primary observations each record exactly one SDK invocation, outcome `threw`
and category `pixelcopy-callback-wait`. Main-queue maximum delays differ (553 ms
and 6 ms); these observations do not prove a shared main-thread, renderer, host,
application or graphics root cause. No capture fallback, retry, threshold change
or root-cause repair is introduced by this retention.

All eleven independent focused safety lanes pass. The aggregate native gate does
not. The private no-backup storage case newly added at this source passes in the
ordinary inventory. That scoped virtual-device result does not test the later
lifecycle implementation, actual FCM registration, real phones or closed-app
delivery. The prior local journal report remains a separate immutable snapshot.

Selected original members from artifact 13088201500 are checksummed here, with
the API's run/source/artifact binding and provider archive digest. The full raw
archive digest was not independently compared. The ordinary transcript is parsed
again and matched to its original JSON. All six primary capture observations are
retained, including the four returned captures; no image is newly published.
The device restoration receipt reports restored/verified. The suite exit receipt
keeps ordinary status 1, component status 0 and local replay status 0 separate;
neither latter exit code promotes a complete replay or release result here.

Four relevant test/capture sources are archived from the exact failed Git commit,
not from the newer working tree. Original passing and failing histories remain
available. The public Site records this latest failure without replacing previous
galleries, dates or the last source-specific full passing gate.

The failure is unrepaired. Future work must investigate the actual PixelCopy
callback/rendering path and retained host/device observations, then re-run the
unchanged full quality gate. Local model success cannot substitute for that run.
