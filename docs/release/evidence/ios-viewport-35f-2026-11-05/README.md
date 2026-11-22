# iPhone Navigation And Readiness, 5 November 2026

[Original run](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/42100296847),
[terminal job](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/42100296847/job/127503931215),
source `35f23fc6ae4f5fba8bc93ded64050df4d38b6d46`.

The SDK build passes. All eleven synthetic iPhone cases execute: nine pass and
two fail, with four assertion failures. Publication and emergency contacts pass
in this run. Booking confirmation and the team-send enabled assertion fail.
The job finishes normally below its unchanged 50-minute limit. Diagnostic and
disposal steps succeed; optional capture steps are skipped and artifacts are
empty. This source does not include the later publication-price correction.

## Observed Navigation Failure

The booking action exists, is enabled and is reported hittable before its tap.
The expected confirmation alert never appears. The bounded accessibility dump
then shows `messages.screen` and the bottom navigation instead of Search.
The exact pre-tap booking frame and hit coordinate were not retained, so an exact
coordinate-interception reproduction is not claimed.

The actual booking handler, run with the same DEBUG gateway, retains the exact
second-child/two-seat acknowledgement and keeps Search open. The source layout
instead overlays the navigation on full-height content using a bottom ZStack;
96 points of scroll-content padding does not allocate a separate viewport.
The candidate uses separate vertical content/navigation regions. The raised
publish action now contributes to the navigation's measured height instead of
being offset outside it. Only the bar background extends below the safe area.
Obsolete default 96-point compensation is replaced by the normal 16-point gutter;
explicit modal paddings remain unchanged.

The existing booking case now reveals its action through bounded user scrolling,
requires its frame inside Search and above navigation, and verifies that the tap
does not open Messages. Every original enabled/hittable, alert, exact booking-text
and OK assertion remains. New bounded frame diagnostics are text only. These are
candidate native assertions, not an already passing native layout result.

## Team Send Readiness

The original immediate `send.isEnabled` assertion fails after loading earlier
messages. Its following tap nevertheless produces the expected message and an
empty editor. This does not identify which native operation held the control.
The actual unchanged production state intentionally disables sends during owned
reads. Four controlled completion boundaries restore send readiness, while all
twelve prior busy-send denials and exact-draft checks remain. The UI case adopts
the existing ride-chat six-second enabled predicate before its original enabled,
send, message-body and empty-draft assertions. Production send policy is unchanged.

## Evidence And Limits

All eleven outcomes, four original assertions, terminal metadata, annotations and
the synthetic accessibility dump are retained. Exact baseline/candidate source
bytes, three failing old-source contracts, passing candidate contracts and full
controlled native output are hashed. These source contracts are not native
hit-testing or screenshot evidence. Current layout and full UI acceptance remain
pending; no permission, provider, network or notification rule is relaxed.

Two Android failures remain separate. The 85e chat prerequisite passes validated
Wi-Fi and backend reachability but has no default data subscription or cellular
availability. Its network preparation fails before handover/draft acceptance.
The 38b remote-stop job fails downloading its selected system image, before any
app flow. The selected error does not prove the download's root cause. Sanitized
records retain those boundaries without publishing their raw logs or media.

The prior 447 progress entries, every flow/status/date/media/tour and blocker are
hashed before this note. Older nine/eleven and eleven/eleven headlines move to
history rather than being deleted or presented as the latest full result. No new
phone session, media, production write, provider request or release acceptance
is added. Eleven cases, 50 minutes and existing capture bounds remain unchanged.
