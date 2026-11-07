# Native Message Reply-Loss Replay

Verified on 2026-10-16 at 13:44:18 UTC in the isolated demo project.

- Tested commit: `920c701a830f42fcf3e0dc44a2e25359e4223352`.
- [Native CI run 38908199432](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38908199432)
  completed successfully, including Android unit tests and the complete local app replay.
- Run ID: `7dde06173a7232117e7f4f689af3b9e0`.
- Original `results.json`: 20 instrumentation cases and 21 passing coverage groups.
  These counts are intentionally different. The twelve instrumentation transcripts
  retain each executed method group; no cases were replaced or made optional.

## Observed Scenario

`LocalChatResponseLossTest` hosts the production `ConversationRoute` and
`FirebaseAndroidConversationGateway` in a test activity. It authenticates the
synthetic parent with the real local SDK and opens a newly approved reservation.
The Firestore SDK network is paused after the empty thread loads, so its separate
live acknowledgement cannot hide a lost callable reply.

1. The actual `sendChatMessage` callable saves the message. A separately supervised
   HTTP worker reads the stored message and its addressed notification, checks
   exactly one of each, then discards the successful reply. The app shows an
   unconfirmed send and retains the read-only draft.
2. After an explicit test control, the worker rejects the next retry with a
   controlled HTTP 429 / `RESOURCE_EXHAUSTED`, without forwarding that attempt.
   The app still retains the original draft and request ID.
3. The final retry reaches the actual callable. It returns the original message.
   The app clears the composer; restoring Firestore networking displays one bubble.
   The host independently requires one unchanged message and one notification.

The retained worker receipt shows exactly three attempts, the same client request
ID and body, two real successful upstream responses, and an injected rejection
between them. The original message ID, creation timestamp and notification ID
are unchanged on recovery. The driver notification remains unread; receiver UI
reading and push delivery are not part of this scenario.

## Evidence And Limits

- `local-chat-loss-ui.json` and `local-chat-loss-proxy.json` are unchanged run-bound
  app/worker receipts. The stricter receipt validator also accepts these originals.
- The three PNGs are unmodified Compose captures. Only the reviewed final and
  rejected-retry captures are added to the private portal.
- Original restart, network, modem and instrumentation receipts are retained
  alongside the completed result. Their independent validators pass too.
- This is real local SDK/controlled-transport evidence, not full-app navigation,
  an operating-system disconnection after commit, a physical phone, expired
  credentials, durable pending-draft recovery, a crash, or push delivery.
- The existing independent OS-network and confirmed-process-restart cases still
  run and pass. They do not extend this controlled-fault result to physical devices.
- A separate local worker probe also passed loss/reject/recover against the actual
  isolated service. That probe is not UI evidence. Its initial invalid fixed UUID
  was correctly rejected; it was corrected only in the temporary probe, not in
  production validation. The app case uses the composer's real random UUID.
- Follow-up code adds stricter receipt validation and a bounded worker-close
  deadline; the above run tested the original equivalent checks. No production
  application, service, rule, role, billing or provider deployment was performed.

Still open: team conversations including authorized parents, phone keyboard and
layout checks, real cross-device delivery, unsent/pending drafts after force-stop,
expired authentication, real post-commit connectivity loss, live push, and the
release manifest's physical tracking and real safety-audit requirements.

Earlier unrelated SlotWriter teardown, missing default-data subscription and
intermittent emulator shutdown diagnoses remain open; a successful run does not
establish their causes. Dependency-audit remediation remains separate and open.
