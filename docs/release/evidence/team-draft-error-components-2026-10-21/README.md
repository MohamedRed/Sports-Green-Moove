# Draft Storage Error Components, 21 October 2026

Actual Android ordinary UI job `119369157123` on source `8da690b` passed.
Run `39642435817`, artifact `12366284791`, contains the original XML, HTML
component report, suite exit statuses and four unchanged PNGs retained here.
Both unchanged storage-error methods executed and passed after the test host's
full-height correction. The preceding failed orientation capture remains in
`../team-draft-error-capture-2026-10-21/`; it is not relabelled as a pass.

These are native Compose component tests with deliberately injected storage
failures, a 320 dp host and 1.3 font scale. The read-error test verifies that
explicit retry restores the original body with zero sends. The write-error test
verifies visible typed text and zero sends during failure, then exactly one
explicit retry send and cleared storage. The two published root captures show
the error states, not the successful retry states. The full-window originals
have status-bar overlap in this component host and are not published.

The XML reports 190 ordinary tests, zero failures and zero errors. The retained
status receipt has zero exit codes for ordinary tests, component evidence and
local replay. Those broader statuses do not extend this component evidence to
service-connected storage failures, phone-to-phone messages, physical devices,
notifications, unread state, production or final release acceptance.
