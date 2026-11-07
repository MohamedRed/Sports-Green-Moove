# Later Native CI Status: Separate Startup Failure

GitHub run 40193292775 completes unsuccessfully on
`899e969c90d404cbbdc38976269e0fb1a517e281`, 25 October 2026.
The main Android UI job, native units and nine focused lanes pass. The focused
native-startup case and its aggregate fail. iOS and paid-map lanes remain skipped.

The retained focused artifact belongs to run ID
`5584f5edb57710f1fd2ecf05035fdc7d`. Its single case fails in the test mock-location
feed with Google Play services disconnection (ApiException 20). The process log
records the persistent service process dying and restarting. That observation
does not establish why it died, an app defect, a clock rejection, or a package
update. Keep it separate from the physical phone's timestamp diagnosis.

The device restoration receipt verifies package removal, original install policy,
administrator removal and launcher/background restoration. The bounded host
observer sees its target gone. These are cleanup proofs, not a passed test.
The main job's success is retained as job metadata only; no new full-replay
counts, primary-copy acceptance, app gallery media or release acceptance are
created from that metadata.

The previous run 40192919693 on `aabb6a9373848e71c274cc1b23f0566ac1db48e9`
failed the main job's primary trip-change-parent-confirmation copy, after the
ordinary matrix reports 166 passed / 54 skipped / zero failed. Its raw failure
and run metadata remain retained, rather than being replaced by this later
main-job success. No transport root cause is established here.

The separate backend, website smoke and release-readiness checks on 899e969
complete successfully. The missing media-inspection dependency is resolved;
the overall Native CI check remains failed. No production app is deployed.
