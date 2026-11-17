# Review Submission Recovery, 29 October 2026

The original component regression (`before.txt`) reproduces a submission error
replacing the entire loaded review list. The later trip date is no longer in the
rendered tree. The new implementation scopes the error to that review, preserves
expanded rows/cursor and disables other submissions while one is pending.

The final component transcript passes eleven cases: two new recovery/layout
cases and the nine unchanged context, pagination and received-summary cases.
Three original synchronized Compose captures are reviewed for publication. They
are synthetic component evidence, not session captures from a physical phone.
The two installed APK hashes were independently checked against the compiled
binaries. All 641 Android unit cases and 547 backend unit cases pass.

The eight isolated service groups exercise actual loopback socket disconnection
both before forwarding and after an authenticated callable has committed a rating.
The exact retry returns the original receipt without changing its timestamp or
creating another rating. Concurrent identical requests converge to one rating;
different score/comment and ineligible, signed-out or unrelated users are refused.
All 158 original records, account claims and prepared trip details remain intact.
No automatic application retry or alternative data source is introduced.

The intermediate native run passes ten cases but rejects a false fixture
assumption: the inbox loads twice during initial observation, not once. Its
original transcript and test source are retained. The final assertion records
the settled pre-submission count and requires it to remain unchanged after the
failed send and explicit retry. It still checks the exact selected trip and score.

Owned local runtime disposal, closed endpoints and the stopped read-only emulator
are checked independently. Original source bytes are kept in `source-archive`;
the application implementation was uncommitted when these local builds ran.

This does not prove integrated physical-phone network loss, iOS UI, deployment of
the production backend or full release readiness. The earlier phone review and
mean/count proof remains separately dated. On source da317d9, Native CI run
40968684893 fails the chat-network retry at `LocalChatNetworkFlowTest.kt:82`;
remote-stop job 123779621879 fails waiting for Home before starting its ride.
Those failures are not repaired or promoted by these review changes. The earlier
provider callback timeout passes on rerun; the separate support service rerun is
tracked independently. Current-head CI must be verified after this change is pushed.
