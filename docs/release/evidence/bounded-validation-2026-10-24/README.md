# Bounded request validation - 24 October 2026

GHSA-mrhx-c7xc-m3w5 is reported for installed Zod 4.4.3. The maintainer fix
checks collection upper bounds before parsing elements; its affected range is
below 4.6.6. Sources reviewed today:
- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd

The exact retained four-case test file runs unchanged before and after the
dependency update. Before: three failures and one pass. A rejected 101-item
position batch and 51-item team-read batch build individual validation errors;
a bounded synthetic array visits all 10,000 elements before rejecting its size.
This is a deterministic validation-work regression, not an OOM attack or proof
that a public deployment was exploited. No unbounded-collection fix is claimed.

After: Functions requires ^4.6.6 and the lock resolves 4.6.7. Only this dependency
changes in the lock. All four cases pass: oversized batches produce one size
issue, the synthetic array visits zero elements, and valid maximum-size batches
still validate every element and reject malformed elements. All 440 backend
unit cases pass and TypeScript builds. The matching production-dependency audit
no longer reports this advisory, but still reports other findings. It is not a
clean security audit and nothing is deployed to production.

The real local Admin-client closure regression is repeated after the dependency
update. Its first invocation does not reach SDK reads because Java is missing
from the default shell; the transcript is retained as a prerequisite failure.
The accepted invocation explicitly selects installed JDK 21 on PATH/JAVA_HOME.
Its unclosed control stays live, while success and task-error cases exit
naturally; the disposable environment is removed and all four endpoints close.
These checks do not accept native UI, physical tracking, push or payments.

The existing 24-group isolated service replay also passes with the new dependency,
including reservations, ride lifecycle, message delivery and trip confirmations.
Its sanitized result and the 25-line completion transcript are retained. The
final independent check confirms the four local endpoints have been released.
