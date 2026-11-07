# Complete Smoke Groups Within Fixed Deadlines

The required `Functions, admin, and website smoke` check requires success from
three independent jobs:

- `smoke`: existing general/admin/website checks, 30-minute limit.
- `people-safety`: support, team conversations and notifications, 20-minute limit.
- `guardian-safety`: guardians, children, profiles, enrollment and ride observations,
  20-minute limit.

Each job installs the locked dependencies, builds the same Functions source and
uses the existing bounded media-tool setup. The new group is a partition of the
previous people/safety workload, not a narrower test selection or a retry. It
adds one runner's setup cost; no job deadline, provider access or test behavior
is relaxed. No production infrastructure changes or Terraform apply is involved.

The immediate evidence is [run 41409493223, job 125159014921](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41409493223/job/125159014921),
source d55a112b129f8bf5bfe0bff0f21a929dc9da2596. Its people/safety job started at
07:56:14 UTC on 2 November 2026 and hit its existing 20-minute limit during
`Verify atomic observation ordering through concurrent location calls` at
08:16:27. The final ride-observer check was skipped. All earlier service steps
passed; the canceled step and skipped step are not accepted. The same group on
664480a had completed in about 16 minutes, leaving little host-variation margin.

`tests/web-smoke-sharding.test.mjs` checks both the original 111-step fingerprint
and the complete current pre-partition workload from pushed source
1db70621fb9d66c68581b9a0926ae867ca407f69:

- All 153 workload steps retain exact names, commands, environments, IDs and
  multiplicity. SHA-256: `1c44659a0d8be19018d3e1957b84516c546cb55b3e8e797acd165626184d73a5`.
- All 19 upload steps retain their exact configuration and artifact names.
  SHA-256: `ac04ddc85195eb2f779e94230aca82bb8d5f1c78587bfb2cbfa7ae6b5d8c9824`.
- Uploads follow their owning workload in its runner. The team identity step ID
  stays with its conditional upload.
- All 125 combinations of success/failure/cancellation/skipping/missing results
  are checked. Only three explicit successes pass the unchanged required check.

Run `node --test tests/web-smoke-sharding.test.mjs tests/ci-media-tools.test.mjs
tests/pr-user-flow-checks.test.mjs`, then inspect all three hosted jobs and their
aggregate on the same pushed head. Local structural tests do not prove that the
hosted services finished or that user flows passed on physical devices.

## Separate Android Failure

[Native run 41409493368, job 125159015041](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41409493368/job/125159015041)
on d55a112 retained 303 ordinary cases: 247 passed, 55 skipped and one failed.
Artifact `android-connected-ui-test-results` has ID 13125998473. Its original
JUnit and instrumentation transcript identify
`TripChangeFlowTest.largeTextParentSeesBothVersionsAndAcceptsWithoutApplying`.
The confirmation-text assertions precede the failure at the primary capture of
`trip-change-parent-accepted.png`, not at a booking or consent request.

The retained schema-4 diagnostic records one SDK invocation, a thrown
`pixelcopy-callback-wait`, 1,127 ms primary elapsed time, and unverified observer
termination. Its empty sample list and two early heartbeats do not establish the
capture failure's cause. The later replay passed but does not replace the failed
ordinary case. This workflow partition neither changes Android capture behavior
nor promotes this failed run, physical tracking, provider proof or release status.
