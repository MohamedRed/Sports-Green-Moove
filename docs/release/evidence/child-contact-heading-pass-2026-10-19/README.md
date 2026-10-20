# Corrected Contact Components, Not A Complete Native Run

Source `f041cde408192e086ba37b5c10ad9be3770bb4c9`, Native CI run
`39341124941`, artifact `12230386074`: all five child contact components and
all seven parent contact components executed without failure, error or skip.
The latter include the deliberately delayed initial-contact reply and history
reply that must keep the child picker open and disabled until selection is safe.
The original JUnit contains 167 executed cases and 41 intentional profile skips;
the skips do not count as child or parent component passes.

Both narrow large-text cases inspect real text-layout overflow. All three child
window captures were visually reviewed: the title is complete, contact and
action stay within the narrow layout, access denial removes the phone, and the
landscape changed-contact state keeps its new synthetic number. The narrow box
deliberately leaves unused space on the larger emulator display. Images retain
the original bytes; no edit conceals a defect. The previous defective captures
remain unchanged in `child-contact-components-2026-10-19`.

Gateways and phone callbacks are in-memory simulations. This proves neither a
child login nor linked-account approval, normal ride discovery, real phone
handoff, physical GPS or production behavior. `visualCompletenessVerified` stays
false: these selected reviewed states do not establish every possible layout.
`headingLayoutVerified` identifies only the newly executed narrow-heading checks.

The main job failed later in `LocalChatNetworkFlowTest.kt:82`, waiting for the
network preparation predicate for 30 seconds, before its intended outage. It is
not a complete replay pass or evidence that the messaging outage succeeds or
fails in production. The original command statuses and sanitized failure
instrumentation remain retained. The independent restoration receipt verifies
the store restrictions and removal of the temporary administrator; it does not
claim the original launcher was restored by the older setup.

The retained preparation snapshots show both transport requests available and
the local backend reachable, but cellular remained the active default instead
of the required Wi-Fi default. The test never reached its outage, draft-send or
recovery assertions. These observations do not establish why the system selected
cellular; no delay extension, retry or alternate passing predicate is accepted.

The separate focused job failed before app execution because the store did not
remain stopped. Its typed negative receipt is retained without turning it into
an app result. The approved new one-case-per-device continuous-guard preparation
is separate work, not evidence that these failed runs passed.

`results.json` indexes original JUnit and captures; it is not a device-exported
flow marker. Source archives bind the executed source, not later infrastructure
changes. Checksums protect the original retained evidence. No release item is
accepted here.
