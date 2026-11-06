# Later iPhone Recheck

Source: `385a6a4418848b46f4ea522c2903ee22be8b1ee6`.
[Terminal job](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/42121584944/job/127575029505).

The SDK build succeeds. All eleven original simulator screen cases execute:
ten pass, one fails with one assertion at `SearchConsentFlowTests.swift:30`.
After granting consent and tapping Search, the first booking-request button is
absent within the original six-second observation. The later search after
changing tracking, seat invalidation and second-child/two-seat booking assertions
in that case do not add failures. This does not establish the cause or reliability.

Disposal succeeds, captures remain skipped, and the API returns zero artifacts.
The 50-minute deadline and all eleven cases/assertions are unchanged. No new
phone, capture, provider call or production write was started for this inspection.

The earlier f61 eleven-case success stays immutable. Only current combined
iPhone automated acceptance is reopened, with a cumulative index inheriting all
other entries. A source-matched earlier pass cannot override this later failure.
Physical tracking, service delivery, emergency phone handoff and release remain
unaccepted. No application fix or diagnosis is claimed here.

The separate Android run `42121584949` passes its focused jobs but its main job
`127575031373` fails while collecting `trip-consent-restart` evidence. This is not
proof of a completed flow or a diagnosed app failure. Its detailed retention and
collection diagnosis remain separate work.
