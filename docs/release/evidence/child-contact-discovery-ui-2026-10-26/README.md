# Child Contact Components, 26 October 2026

Source `3b386a023bd92ce66958e6a3d28c8fa64b97d370`, native run
`40319003618`, main job `121558809939`.

All nine child components executed and passed: two account-link dialogs, two
denied-location routes and five read-only contact cases. This includes the
corrected no-active-ride discovery case, which performs one discovery and no
known-ride read, keeps linking accessible and exposes no phone/edit action.
The denied-location Trips case has no adult ride snapshot and starts no tracking.
These are component tests with mocked gateways/dialer callbacks, not a physical
child login, account invitation, real dialer or connected-backend journey.

The overall ordinary matrix still failed: 224 observed cases, 169 passed,
54 intentionally skipped and one failed. The sole failure is
`TripChangeFlowTest.refusalKeepsTheInitialTripWithoutCancellingTheBooking`.
Its original stack reports `Failed waiting for PixelCopy!` in the primary
`captureLocalUi` call, after the refusal-status assertion. This is an observed
screen-copy wait failure, not a diagnosed graphics/SDK root cause. The later
booking-preservation assertions were not reached. Do not accept that trip flow,
the full Android gate or release readiness from these nine child passes.

Original result JSON, XML, native exit status and the failure block are retained
unchanged; source hashes resolve to immutable archives. No screenshots are
accepted or published from this run. No retry, capture alternative, production
write, provider request or physical-device result was added to bypass the failure.
The earlier 61d1294 no-ride failure remains separately retained.
