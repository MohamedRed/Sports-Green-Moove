# Focused Network Preparation Failure, 2 November

Source: `30272e0ca56d3c50ffdf0258f8a13eabf1b49d9f`.
The [original focused job](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41445572945/job/125277691092)
fails in `LocalChatNetworkFlowTest.kt:83`, while waiting for both transport
prerequisites. Its original instrumentation reports one failure, not a passing
resend. The failure is retained without rerunning, widening its timeout, changing
radio settings, substituting a screenshot method or bypassing a gate.

The screen reached the conversation and draft before network preparation.
Wi-Fi and the isolated backend were reachable, but the default mobile data
subscription was missing before app installation and remained missing afterwards.
No cellular-available callback occurred; the disconnection/send sequence was not
executed. The earlier Wi-Fi-only preparation check passed, which does not prove
the separate cellular prerequisite. These observations locate the blocked stage;
they do not establish why Android failed to select a default subscription.

The retained selection history contains no recognized events or readiness state.
Null log properties and absent history do not prove that the controller never ran
or establish the process minimum log priority. No logging settings were changed.

The original ZIP is artifact `13142393131`, 368,601 bytes, SHA-256
`b193d4821e507aff032d8d058376d02ab8a7c08e539579de185631b7614c946c`.
`archive-verification.json` binds all twelve selected original members byte for
byte. The ZIP, raw process logs and screenshots are not published. The suite's
nonzero status and the completed failed job remain authoritative negative proof.

The independent device receipt verifies app removal, policy restoration and
administration-component removal. The host observer records the process gone
without requesting a signal. Disposal is not a user-flow pass.

The separate complete success at `638066c` and earlier physical controlled-loss
results remain source-specific historical successes. This failure does not erase
them, prove a new app regression, accept the current full gate, or establish that
intermittency has been fixed. No new phone trial, public media, production writes,
provider requests, safety evidence or release acceptance is added.

Web Integration Smoke already executes `tests/network-preparation-recheck.test.mjs`;
that test now covers this original failure, forbidden promotion and rehashed
contradictions. No workflow workload, infrastructure or audience is changed.
