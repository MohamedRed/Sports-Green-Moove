# Completed subsequent gate at 398d207

Exact head: 398d207b52b925b9c6d1dae49419e6a848d05161, 26 October 2026.
Native run 40406032732 and all enabled PR checks completed successfully; five
intentional skips remain (three approved-map lanes and two iOS lanes).
All three native suite exits are zero. The ordinary matrix has 231 cases:
177 passed, 54 skipped, zero failed. The separate local replay passes all 37
groups and 40 native cases. Original downloaded JSON reports are retained.

The primary trip-consent-recovery copy completed with status 0. Its new bounded
daemon-event observation is available before and after, with the same one event:
21:44:29.207 local time, PID 3546/TID 3554, emulator 5554, connection terminated
after a read failure. The copy receipt is recorded at 21:59:58.939 UTC. This is a
historical event in a successful run, not an event newly observed during that copy
and not a cause for earlier failed runs. The parser now has live retained output;
raw daemon logs were not retained, no extra trace/retry/restart was introduced.

Earlier failed primary copies at ed851, 4db and 3b remain distinct. This later
pass does not establish a root-cause repair, make those runs pass, or prove that
the intermittent transport issue cannot recur. No public media, physical device,
provider delivery, production deployment or release acceptance is inferred.
