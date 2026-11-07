# Search Contract Build Dependency

The `9ae6ea7` Linux smoke job fails compilation before any contract case: importing
the chat models for the shared text normalizer also imports Apple CryptoKit.
The exact failed job/step and selected compiler error are retained. This is not
a failed booking transaction or an executed negative route case.

The candidate moves the existing `TeamChatText` enum into a Foundation-only
source file. Its full implementation and every existing chat crypto/model
declaration remain byte-equivalent, apart from the moved declaration and trailing
whitespace. All four manual Swift compiler entry points include the new file.
The portable search runner imports only that normalizer, not the unrelated chat
models/wire code. No CryptoKit shim, alternate crypto, dependency installation,
conditional fake implementation, fallback or skipped assertion is introduced.

All three actual serializer results, sixty malformed response groups, delayed
ownership/transport cases, complete native logic checks and strict signatures
pass locally after extraction. The existing native/fixture checks, eleven cases,
50 minutes and capture policy are unchanged. The live `9ae6ea7` iPhone run is not
cancelled or restarted; this later source layout still needs its own SDK build.
Linux execution and native SDK/UI acceptance remain pending until a new run
actually proves them. The original failure and every previous evidence record
remain immutable. No new device, provider call, payment, cloud change or media
is involved; the public partner site keeps the separately verified booking result.
