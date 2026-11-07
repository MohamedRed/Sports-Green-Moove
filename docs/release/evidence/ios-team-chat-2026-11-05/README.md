# iPhone Team Conversations: Local Checks

Checked 5 November 2026. The actual iPhone source now connects club/team choices,
current-admission message history, earlier pages, visible incoming read receipts,
and a private persisted composer to the existing server callables. This is a
source implementation with controlled local checks, not an executed iPhone UI.

The native logic suite passes, including 96 delayed success/error boundaries for
account changes, roles, close, background and cancellation; 32 malformed message
groups; 18 choice/request/receipt groups; six server-compatible identity vectors;
and draft isolation, persistence, storage failures and admission changes. Unknown
sends retain their original body and ID for explicit retry or read reconciliation.
Storage failure never silently switches to a volatile draft. Only visible incoming
messages can be marked read; unknown read outcomes require explicit recovery.

Three independent disposable local-service runs pass: 18 conversation checks,
six discovery checks and 12 read checks. They exercise the actual backend without
production writes. Each reports protected data preserved, its client closed and
its environment destroyed. These are separate from the controlled client tests:
the new iPhone adapter has not called those services in an integrated native run.

The strict controlled SDK-signature check passes, including the real adapter and
debug-only fixture. SwiftUI files parse. Neither result establishes an SDK build,
layout, keyboard/scroll behavior, native permissions, device notifications or a
physical phone run. The existing messages fixture case has been extended to cover
selection, restored draft, earlier messages and send. All eleven cases, the approved
50-minute gate and the existing three-image/one-day policy remain; no new capture
is added. Both current SDK/UI release entries remain pending.

Still unverified: real iPhone screens and callable integration, actual incoming
notifications, account/permission changes across a closed app, and a lost send
followed by revoked and restored team admission. An unresolved old send is not
silently discarded or given a new ID. Booking conversations and full release
requirements remain separate incomplete work. No new media, real accounts,
payments, map calls, billing, infrastructure or Site access changes accompany this
result. Historical flow statuses, dates, tours, galleries and failure records stay
unchanged.

`summary.json` records exact layers and outcomes. `source-sha256.json` identifies
frozen content-addressed source archives; the two controlled transcripts and three
sanitized local-service result records retain the executed results. Earlier test
harness failures remain private diagnostics, not represented as passing runs.
