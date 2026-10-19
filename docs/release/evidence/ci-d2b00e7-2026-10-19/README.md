# Remote Checks For d2b00e7

This terminal GitHub snapshot is separate from independently passing local cases.
`checks.json` identifies head `d2b00e706cdf252392842ba01e98309f398c5321`.

- Backend, Android units, native identifier coverage and release static checks passed.
- Native UI failed in `TripChangeFlowTest` with `Failed waiting for PixelCopy!`.
  The subsequent disposable-device installation verification also detected a
  changed map runtime. The original failed log is retained as `native-failed.txt`.
- Web smoke failed its actual SIGTERM shutdown check: exit 1 rather than 143.
  Its original failed step is retained as `web-failed.txt`. The supervising
  program's error was previously hidden by the checker; this change adds redacted
  diagnostics without accepting exit 1 or relaxing process/endpoint checks.
- iOS and externally distributed phone runs were intentionally skipped, not passed.

The later independent remote-completion local native pass does not replace these
failures. The historical full local replay's startup ANR is also retained in
`../native-startup-replay-anr-2026-10-19/`. No whole-run or release success is inferred.
Both actual local shutdown signals passed again on 19 October, under the unchanged
supervision policy, but that local result does not establish Linux CI recovery.
