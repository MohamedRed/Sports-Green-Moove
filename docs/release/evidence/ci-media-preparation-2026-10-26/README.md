# Media Preparation Retry, 26 October 2026

The people/safety job for pushed application head `f773b3d` ended cancelled before
any user-flow step. Its original job metadata is retained. The download excerpt
preserves original step timestamps and selected APT lines, not rewritten timing.
The complete downloaded log remains in the private local trial directory.

APT updated its indexes quickly (12.6 MB in one second), then spent about nineteen
minutes downloading the 62.8 MB FFmpeg dependency set through the runner-selected
HTTP Azure archive. The earlier `4454cc1` trial stopped in the same preparation.
These facts identify the blocking phase and transport, not the precise underlying
reason for the low bandwidth. No application assertion failed in that job, and
none of its skipped service steps counts as a pass. Other job outcomes are not
inferred from this one terminal job.

## Candidate Repair

Both smoke lanes now install from explicitly configured official Ubuntu HTTPS
archives, including the security pocket and the Ubuntu signing keyring. The
installer uses a temporary source file; it does not rewrite the runner's global
repository configuration or install anything on a personal computer. Updating
indexes must succeed; package installation and both `ffmpeg` and `ffprobe` checks
must succeed. There is no alternate installer, stale-index continuation or
signature bypass. Preparation is bounded to four minutes inside a five-minute
step, while the existing thirty/twenty-minute job limits and all 111 original
user-flow workload steps remain unchanged.

Five local evidence/contract/failure-injection checks pass. The original full Node suite
passed 2305 cases before this installer change; the broader replay is separate.
The repair has not yet executed on a hosted Ubuntu runner in this record. Do not
claim the transport issue or the people/safety gate is resolved until that real
installation and its downstream service checks complete.

APT configuration follows the official documentation for
[source signing](https://manpages.ubuntu.com/manpages/noble/man5/sources.list.5.html)
and [transport limits](https://manpages.ubuntu.com/manpages/noble/man1/apt-transport-http.1.html).
No infrastructure or Terraform resource was created or changed.
