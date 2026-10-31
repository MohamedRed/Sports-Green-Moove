# CI Evidence Upload Ordering

Web Integration Smoke runs its checks and builds before uploading any reports.
The five existing artifacts, paths and upload action are preserved. Every upload
still uses `if: always()` so available evidence is collected after failed tests,
and an upload error still fails the job. There is no ignored failure, retry,
timeout increase or substituted evidence.

This corrects an execution-order problem observed in
[run 39087980928](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39087980928)
on `608bc4168c99ff9726aa49c093986b607e0569fd`: the first report upload failed
with `Failed to CreateArtifact: Unable to make request: ETIMEDOUT`. Only the early
function/date/history checks ran; later builds and user-flow checks were skipped.
That run remains failed. Moving uploads does not fix the remote artifact service
or retroactively execute those missing checks; it prevents future report-service
errors from stopping subsequent app checks.

`tests/pr-user-flow-checks.test.mjs` requires all five uploads to follow all test
and build commands, retains their always-run behavior, and rejects hidden upload
failures. The smoke job runs this guard itself; Release Readiness also retains
its existing verifier test. No runtime app, production resource, access policy or
Terraform change is involved.
