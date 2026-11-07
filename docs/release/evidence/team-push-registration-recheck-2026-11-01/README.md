# Current-Account Registration Recheck

1 November 2026. Nineteen isolated callable checkpoints pass with synthetic
registration tokens, plus 571 unit cases and the same twenty database-rule and
acknowledgement cases. No real token, provider send or phone delivery is accepted.

An expanded negative trial demonstrated that an earlier adult login could still
register after the account's current claims included child. Its original log is
retained in `stale-claims-trial.txt`; it is a failed trial, not a pass. The common
team authority check now reads current account status/claims as well as the caller
claims, profile and linked-child status. This protects registration, directory,
history, sending and alert acknowledgement; it is not a registration-only patch.

The successful recheck directly rejects the old adult login after current child
claims, and separately after disabling the account. Directory, history, send and
alert-read calls are refused; protected alerts disappear from the inbox. One
earlier legitimate driver message remains alone, with two generic alerts, one
pending envelope and no team-read receipts. Temporary role/disabled transitions
are restored; every original record and account claim remains unchanged.

Current account lookups are cached only within one transaction attempt, never
globally. Retry attempts create a new context. Bulk recipient lookups reuse their
fresh account records rather than adding one network lookup per recipient.
Six unit cases cover cache scope, identity, disabled/deleted accounts and failures.
The other fifteen registration-domain cases and the 16 earlier registration
checkpoints remain covered. The original 16-checkpoint bundle is retained at
`../team-push-registration-2026-11-01/`, along with its separate fixture failure.

Source hashes before build/after execution bind selected sources, not the entire
head. The first fixture error and the stale-claims negative are not source-attested
successful runs, and neither is overwritten. Reports/crops from earlier phone
tests are not relabeled. Native lifecycle, dispatch, receipt, taps and release
acceptance remain unfinished. Both local clients close; the disposable runtime
and its four listeners are removed. No customer data, payments or paid resources
are used. Public publication is only a short local-result note, without new media.
