# Baseline Chat Network Preparation Failure

Run 40749184464, job 123030965888, baseline a4995ce.
The focused chat-network job is terminal failure. The overall native run was
initially still in progress, then completed as failure. Its terminal metadata,
original component XML/instrumentation and suite exits are retained separately.

Instrumentation fails at LocalChatNetworkFlowTest.kt:82 after its existing
30-second preparation wait. The retained marker has `completed=false`,
`failedPhase=network-preparation` and an empty network-transition list. Its initial
and final default transport is cellular, while Wi-Fi and cellular are both
present, both requests report availability and the isolated backend is reachable.
No disconnect, retained offline draft, retry or reply is accepted from this trial.

Both network requests are released. The independent host restoration receipt
verifies restored policies and removal of local app/test administration. That
restoration is not flow success. Do not infer a renderer, carrier, routing or
product root cause from these observations, increase timeouts or rerun the job
to discard its original failure. Existing successful phone media remain distinct.

The later dependency regression/compatibility results are a separate test scope.

## Terminal Main Gate

The ordinary matrix records 237 cases: 182 pass, 54 skip, one fails. The failed
team-conversation case rejects a blank capture at TeamConversationFlowTest.kt:57.
The native component-evidence step exits zero; the local replay exits one during
the original primary trip-consent-recovery evidence copy (status one, incomplete).
The original copy receipt is retained. None is replaced by cleanup, a later
successful sample or the dependency patch. No renderer/transport root cause or
production regression is established by these records alone.
