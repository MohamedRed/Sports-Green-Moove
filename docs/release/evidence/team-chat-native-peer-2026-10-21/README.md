# Partial Native Team Exchange, 21 October 2026

This is a failed native case with partial observations, not nine accepted
checkpoints or independent persisted-state proof.

Source: commit `6a99378adb804c4226e9b4e6de8e033f8a280888`, workflow
`39604033406`, dedicated job `119235529032`. The original artifact ZIP is retained
and its bytes match the digest returned by GitHub. The completed job conclusion
is `failure`; no result is converted to a passing run.

The actual parent app opened its approved team and received a driver's SDK-peer
message. The parent replied in the app, and the driver SDK read that reply before
the exchange capture. After activity recreation, the draft assertion passed and
a third capture was taken. The subsequent creation of the manager SDK peer threw
`FirebaseApp was deleted`. The failure stack points to that later statement in
the retained test source. The first peer had already been deleted by its `use`
scope; the corrected scenario keeps both peers alive until all UI/account
operations and the activity are closed. The correction still requires a new run.

Only the two reviewed original full-window captures, parent and exchange, are
published. The draft window has incomplete header rendering and is not published;
the root originals remain retained but are not a claim of visual completeness.
The setup, original instrumentation failure, successful partial evidence transfer,
command failure and fully verified device restoration are retained unchanged.

The full case did not finish and its independent five-message/guardian/baseline
verifier was not reached. Revocation, directory removal and account/draft isolation
are therefore not accepted. This uses an isolated local backend on a dedicated
verification machine, not a physical phone or push notification delivery. There
are no production writes or new videos. The earlier local startup ANR remains
separate in `team-chat-native-startup-2026-10-21/`.
