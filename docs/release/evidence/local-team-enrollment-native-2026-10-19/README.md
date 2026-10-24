# Connected Native Team Enrollment

Original scoped evidence from [Native CI run 39229778161](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39229778161)
at `f95c8f7cc193444dcbdbc03bce7120fa83e8fba8`, recorded on 19 October.
The nine original files are retained byte-for-byte with `artifact-sha256.json`.
All five app screenshots were visually reviewed before inclusion in the private
progress portal. They replace the simulated component images in its current gallery.

One actual native test passed ten checks against isolated local services:
cancel without writing, parent request, manager refusal, new request and approval,
activity recreation/reselection/fresh read, confirmed withdrawal, verified-parent
child request/approval, denied stale withdrawal after parental revocation,
visible manager revocation, and account isolation. The fixture validator confirmed
two enrollment records, eight enrollment events, three parental-link events,
protected unrelated records and exact fixture cleanup. Parental verification was
performed through authenticated transitions, not preseeded as approved.

The manager acts through the authenticated local SDK in this native case, not
through the management browser. The separate manager-browser proof from 18 October
is not combined into an unexecuted end-to-end two-UI scenario. Activity recreation
does not prove full process restart. This evidence does not implement team history
or group conversations, prove a physical phone, deploy production, or accept any
release-manifest tracking/payment requirement.

The successful primary team transfer, original device marker, one-case transcript,
five PNG hashes and twenty unchanged source hashes are validated by
`scripts/qa/team-enrollment-retained-evidence.mjs`. The transcript also confirms
that installation blocking was active. This is a scoped team-case pass, not a
whole-matrix pass: the run later failed its primary trip-consent-recovery transfer.
Guard activation, cleanup and the later offline failure are retained separately
in `../disposable-installation-guard-2026-10-18/verified-2026-10-19/`.
