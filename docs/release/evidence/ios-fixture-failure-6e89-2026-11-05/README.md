# iPhone fixture result, 5 November 2026

Source: `6e898a90b23fc0c2ea8c951af02a7246c760ad84`.
[Terminal run](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/42096199969)
and [job](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/42096199969/job/127490262040).

The standard public ARM runner completes the job in under 25 minutes, without
reaching the unchanged 50-minute deadline. SDK compilation succeeds. All eleven
synthetic screen cases execute: nine pass, two fail, with four assertion failures.
The test process exits 65. Diagnostic and simulator disposal steps succeed.
The artifact inventory is empty; neither optional capture step runs.

## Remaining Failures

- Second-child/two-seat search and booking: the expected confirmation alert and
  its text are absent; tapping its OK button fails. Cause remains unconfirmed.
- Publication: the final publication action is missing. This source predates the
  reproduced seed-order correction retained in the earlier 584 evidence folder.

The personal emergency-contact case passes here, although it failed on 584.
The later 35f navigation correction is not present in this source: this passing
case does not establish its effect or reliable emergency behavior. Nor can the
duration of one ARM run establish a general performance guarantee.

`cases.json` retains all eleven outcomes; `selected-failures.txt` retains all four
assertion records. `terminal-job.json`, annotations and artifact inventory keep
the remote conclusion distinct from the older deadline cancellation. Each record
is hashed in `summary.json`. Relevant exact source bytes are retained by SHA-256
in the shared source archive. `portal-before.json` hashes every preceding flow,
progress entry and blocker, excluding this newly added note.

No test, assertion, timeout, capture limit, authority, network or notification
policy is changed. No new phone session, provider request, media or production
write occurs. The later 35f candidate still needs its own SDK/UI result. Both
current iPhone manifest entries remain pending. Physical tracking, operational,
safety and full release acceptance remain open. Historical reports and all
public flow statuses, dates, media, tours, blockers and access are preserved.
