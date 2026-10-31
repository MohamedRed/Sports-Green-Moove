# Independent chat recovery repeat

The 30 October isolated Android emulator trial on `9abc639369a9d2a40a7917a578a981c7d5953ce6`
completed one native UI case in job 124201947693, workflow 41096043272.
Artifact 12996777529 has provider digest
`sha256:bed0b6a7eb442606252c6075f975740e846e8f1322ceb5eaf085c981fdeab227`.
The original result, app receipt, instrumentation transcript, primary copy,
setup, restoration, job and artifact metadata are retained with local checksums.
All reported source files match the archived bytes from that exact Git commit.

The actual test switches from validated Wi-Fi to cellular, removes both
connections, observes an unconfirmed send with the draft retained, restores
connectivity and explicitly retries. It then receives the driver's reply.
Independent stored-state checks find two messages, two notification records and
zero duplicate messages. Callback requests are released, policy and installation
administration restored, local apps removed, isolated services destroyed and
their endpoints closed. Notification records do not prove push delivery.

Network is disabled before the first send, not after a server commit. There is
no process restart, physical device, token-expiry, multi-phone, production or
real-payment proof. No new public media is published; older images retain their
original dates. The complete native gate was still running at collection time.

This trial predates the passive Wi-Fi prerequisite introduced in `1912841`.
Its passing result cannot be attributed to that later code. The local read-only
prerequisite timeout and earlier CI preparation failures remain separate negative
evidence. The underlying intermittent DNS/validation cause is not established.

The public update may report this single repeated simulated flow, while Messages
stays partial and its physical-network/multi-phone requirements stay open.
Existing web integration coverage runs `tests/chat-network-latest-evidence.test.mjs`;
that file now also validates this exact repeat. No new infrastructure or map
request is required.
