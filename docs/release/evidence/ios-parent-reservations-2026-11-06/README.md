# iPhone Parent Reservations

At source 05cd3f7 the parent Trips tab renders the public trip list and has no
parent reservation list/cancel callable. The candidate adds an owned parent
directory with explicit paging, current/history views, server-authorized
cancellation and an immutable confirmation target. Search and active-ride
navigation remain available. Driver trip behavior is unchanged.

All pages check the parent UID, strict status/actions, bounded integer seats,
nullable change references, duplicate IDs and non-repeating cursors. An empty
filtered page retains its continuation. Late account/role/lifecycle replies cannot
restore a directory or claim cancellation. Unknown write replies clear actions
until an explicit read; no automatic write retry or invented refund completion
is introduced. A confirmed cancellation remains visible if a later refresh fails.

A later UI-only refinement suppresses the empty-state claim while a continuation
exists and adds that assertion to the pending screen test. The retained local
logic/adapter inputs are unchanged; this display refinement is not native screen
acceptance and must be included in the next complete source-bound SDK/UI gate.

The actual local native plan passes: 21 malformed response rejections, 12 delayed
read/cancel boundaries, four paging failures, non-parent denials, confirmed and
unknown-response recovery. The strict Swift 6 signature check also passes. The
actual adapter executes 12 scripted list/cancel callback outcomes and five
pre-call denials, checking exact parent/cursor/booking payloads and live identity
before/after callbacks. Scripted modules are not a Firebase SDK binary or server.

One existing booking screen test is extended additively; the eleven-case
inventory, 50-minute limit and capture bounds are unchanged. The previous web
failure's exact old/new reward assertions are also included in the workload
contract without removing any original assertion. Historical local reports now
validate their immutable source archives rather than requiring unrelated future
UI additions to stay byte-identical.

The current SDK build, native screen sequence, live backend mutation, real
refunds, physical/operational/safety evidence and release acceptance remain open.
Both automated iPhone entries remain pending; only their pending descriptions
change. All previous manifest entries, source archives and failure references are
preserved. No production data, billing, maps, phone session or capture is created.
