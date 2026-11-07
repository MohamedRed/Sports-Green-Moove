# Native Gate Stops Before Tests: Insufficient Hosted Disk

Native run 41120151150 / job 124284519409 is terminal failure on e64555e.
The unchanged Pixel 6 / API 35 Play Store device never boots. Emulator 37.2.13.0
reports 6926.72 MB available for userdata against 7372.80 MB required, then the
runner waits 600 seconds for the missing device and fails. No ordinary or
integrated app UI case executes. This is not the earlier mid-test capture-copy
failure and does not explain or repair that earlier transport issue.

The retained excerpt, job/run metadata and terminal whole-PR snapshot preserve
the failed main gate separately from eleven successful focused device jobs,
successful native units, backend, provider validation and generated-file transport.
The web main job separately fails two outdated gallery-shape assertions: the
five new stale-cancellation images were wrongly counted as historical maps and
the tour was still assumed to contain only its original five steps. The updated
tests retain the exact old 25 maps / 41 unique earlier images / five old tour
steps, while checking the five new images and five new steps separately. No map
evidence, date, provider call, or acceptance threshold is removed.

The proposed hosted-capacity guard runs after APK compilation and before device
startup. It may remove only the unused preinstalled /usr/share/dotnet directory,
and only in the Linux GitHub-hosted full-native job. This repo has no .NET build
or test dependency. It requires 11 GiB before proceeding, checks capacity again,
and preserves a receipt. Personal/self-hosted machines, other jobs, symlinks and
arbitrary cleanup paths are rejected. If capacity remains low the job stops;
there is no alternate cleanup path, automatic retry, smaller userdata partition,
changed renderer, shorter test matrix or accepted incomplete outcome.

Local guard tests use injected filesystem/process doubles and never remove a
real tool directory. They do not prove hosted capacity was reclaimed. A new full
CI run is required before claiming this change works on the actual runner.
No Terraform resource or paid machine change is made. Release remains incomplete.
