# Search Selection Invalidation

Baseline: `959e70b41abb039037f94e6eeec8402b597b5bff`.
The old screen uses five deferred selection callbacks. Replaying each exact
callback after a newer prepared or completed search erases that search: ten
controlled state observations. This demonstrates an ordering defect, not that
this ordering caused the retained 385 native-screen failure.

The candidate moves form and query writes into an account-owned observable
selection state, and resolved-place invalidation into the actual app-state
property setters. The obsolete deferred callbacks are removed. A genuine edit
revokes authority synchronously; no delayed duplicate invalidation is scheduled
to clear a later search. Exact same-value updates remain no-ops.

Actual compiled application/fixture checks preserve ten new searches, revoke
ten genuine edits, and drain five late responses without prematurely releasing
work. They also check reverted edits, explicit consent reset, private selection
reset, unchanged child reconciliation and stale-owner/new-generation isolation.
The full native logic suite and scripted adapter/signature checks pass.

These are controlled state checks with synthetic gateways, not UIKit/SwiftUI
rendering, native SDK, map, storage, physical tracking or real-service evidence.
The two harness entrypoints differ intentionally: the baseline replays retained
old callbacks; the candidate exercises production property writes. They are not
claimed to be identical-source before/after tests or proof of screen timing.

Every original screen assertion and six-second wait remains. A bounded 16,000-
character synthetic accessibility description is evaluated only when the
original initial-search assertion fails. No screenshot or artifact is added.
The gate retains eleven cases, standard public machines, optional captures off
and the approved 50-minute limit. Current automated acceptance remains pending;
the historical success and later ten-of-eleven failure are unchanged.

No commission, membership, notification policy, production write, real payment,
new phone session or release acceptance is introduced.
