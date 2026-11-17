# iPhone Reward Navigation

The existing rewards button had an empty action. The source-wiring regression
fails against the original source and passes after replacement. The button now
opens the existing payment settings for an account granted the driver role;
parent-only, child and club-manager accounts receive an explicit refusal. It
does not create a provider account, onboarding link, payment or transfer. Its
label describes the destination rather than claiming a withdrawal.

The actual local native plan passes. Its new checks execute both granted role
routes, four denied role sets, invalid mixed child roles and seven stale
account/role/screen boundaries, including a current access from another scope.
Captured account access prevents an obsolete view from navigating a new session.
The first draft of the check incorrectly unwrapped access for intentionally
invalid child-plus-driver roles; that failed attempt is not acceptance. The final
check correctly verifies that invalid roles cannot create account access.

The existing secondary screen case adds both destination and refusal assertions,
without changing its previous assertions or adding a twelfth case. The original
50-minute job limit and capture policy are unchanged. Complete SDK/UI execution,
visual button interaction, provider onboarding, funds transfer and release
acceptance remain unverified for these inputs.

Only the two automated iPhone entries are reopened. Exact before/after manifests,
the new inherited index, source hashes, initial source-regression failure and
successful local checks are retained. The d3 pass and all earlier failures remain
in history. Physical, operational, safety, store and other automated requirements
are unchanged. No real user or production data is modified.
