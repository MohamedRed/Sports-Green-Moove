# Capture Sampling Gap

Original Native CI run 41032802463 at 60814d7 ends in failure. Its complete
ordinary report has 197 passes, 54 intentional skips and one failure:
`TripChangeFlowTest.refusalKeepsTheInitialTripWithoutCancellingTheBooking`.
The original six version-two diagnostic JSON files and suite statuses are
retained unchanged and checksummed. Component collection and integrated replay
exit successfully; they do not override the ordinary failure.

The failed `trip-change-parent-declined.png` primary operation takes 1,939 ms.
Main-queue heartbeats continue, with a maximum observed delay of 37 ms. All three
caller stack samples, scheduled at 250, 600 and 900 ms, are inside `forceRedraw`.
The final assertion identifies the later PixelCopy callback wait. There is no
stack sample from that later wait, so the evidence does not explain its cause.
Queue responsiveness is not proof that the renderer or callback worked.

The test-only observer now schedules three samples at 250, 1,200 and 1,600 ms.
Version three records that schedule explicitly; versions one and two retain
their original early-sample semantics. The original SDK call, one-second SDK
callback deadline, existing SDK-internal behaviour, capture-quality checks,
single invocation and observer termination bound are unchanged. No outer retry,
alternate image source or application fallback is introduced. The observer can
still affect scheduling and cannot establish a root-cause repair by itself.

The new test APK compiles successfully. Its hash and exact source hashes are
retained in `build-summary.json`; the sources are archived separately by hash.
The new native schedule assertion is compiled, not yet executed in this record.
Host schema/collection checks validate both historical and new records. This
preparation is not a new successful full gate, phone flow, screenshot or release
acceptance. Earlier negative evidence and all remaining user-flow requirements
stay open. Raw diagnostics must not be published on the partner site.
