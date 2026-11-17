# Scoped automated acceptance

The retained 6fb gate postdates the 964 failed recheck and matches all current
iPhone build inputs and workflow jobs. The acceptance changes only the two
automated iPhone entries, plus the manifest generation date. Before/after
snapshots and their hashes retain all previous references and requirements.

The new cumulative index inherits the exact latest failed-recheck index without
overwriting either existing same-day file. Terminal completion time and job
identity now name both acceptance and recheck indices. A regression first
reproduced the existing dated-index collision, then verified success, unchanged
prior files and duplicate-run refusal. This is not a fallback or a test rerun.

Physical, emergency action, operational, safety and full release requirements
remain open. No production app, resources, provider transaction or paid storage
was changed for this acceptance.
