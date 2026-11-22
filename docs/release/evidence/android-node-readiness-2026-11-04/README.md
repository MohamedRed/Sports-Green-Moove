# Android Node Readiness, 4 November 2026

## Retained Failure

Run `41907489530`, job `126845938435`, source
`0d502700fbbcbf66682912b0f44557c6f4feeaba`, fails its main Android UI gate.
Its ordinary command reaches its unchanged 720,000 ms host deadline: case 335
completes, case 336 starts, and no complete result exists for all 349 cases.
Independent connected replay then fails in the first parent-login wait because
there are no registered Compose roots. Failure cleanup cannot copy a directory
that the uncompleted flow has not produced. Eleven focused lanes pass separately;
they do not accept the main gate.

The retained records are selected unchanged entries from artifact `13361114403`.
The original ZIP digest and per-entry digests are in `summary.json`. The original
archive stays outside Git. Process exit information reports a force stop due to
finished instrumentation, not an established cause of the missing interface.
The underlying root-absence cause and ordinary-command slowness remain unknown.

## Separate Baseline Success

The already-running baseline run `41911782130` subsequently succeeds at
`3e7cd40e62798ba503c383e044e25231dc3072bd`, before this readiness candidate exists.
Its main job `126860962953` completes the ordinary command with 294 passed,
55 intentionally skipped and zero failed cases, then completes the connected
replay, including the parent verification flow. All eleven focused lanes pass;
the paid-map and separate iOS jobs in that workflow remain intentionally skipped.
The host disposal receipt observes the disposable process gone. Selected unchanged
records from artifact `13364923777` and the source-bound terminal job inventory
are retained as `baseline-*`. No new images are published from that archive.

This is a baseline native-matrix pass, not execution of the new readiness helper
or proof that the earlier missing interface, timeout or copy failure is fixed.
The new candidate must pass its own native run. Physical tracking, live providers,
payments and overall release acceptance remain outside this result.

## Candidate

The original positive polling queries require an existing composition before they
can return false. This can abort a readiness wait before its intended deadline.
The candidate uses one bounded wait that explicitly allows zero roots in each
query, while still requiring a nonempty collection of matching nodes to succeed.
No exception is caught or treated as success. A permanently absent screen must
still fail at its original deadline.

The installed Compose 1.10.6 convenience wait also uses the default root-required
query; its actual cached bytecode was inspected. The candidate therefore uses the
explicit `fetchSemanticsNodes(atLeastOneRootRequired = false)` query inside the
existing `waitUntil` engine, not that convenience method. See the
[collection API](https://developer.android.com/reference/kotlin/androidx/compose/ui/test/SemanticsNodeInteractionCollection).

All 101 simple positive waits with explicit numeric timeouts and merged-tree
queries are migrated across 71 test files. Tag/text matcher arguments, substring
settings and every original deadline are preserved. The recorded transformation
compares the full resulting files against the baseline at
`3e7cd40e62798ba503c383e044e25231dc3072bd`: only these expressions and required
matcher imports differ. Complex, negative, unmerged-tree and variable-timeout
queries remain unchanged. Production app code is untouched.

Two actual instrumentation regressions are added: no composition must produce a
timeout, and a composition mounted later must contain the requested node. Both
assert that no root exists initially; the delayed callback is cleaned up in a
finally block. The complete test APK compiles offline; both test methods and the
shared helper are present in its DEX files. This is compilation, not execution.

## Limits

No new phone session, provider request, screenshot, real account or payment is
used. The two new regressions and the full candidate matrix still need native
execution. The ordinary host deadline is not increased, the missing directory
is not turned into a successful copy, and no retry or alternate capture is added.
No full-gate, physical tracking, complete user-flow or release acceptance is made.
The unchanged iPhone candidate continues in its existing run, separately.
