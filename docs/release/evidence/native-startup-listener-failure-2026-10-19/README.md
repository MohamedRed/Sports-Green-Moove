# Synchronous Listener Revocation Did Not Resolve Cleanup

The original independent Android case passed in 38.121 seconds, including service
startup for a retained point, refusal for a future point, a valid retry without a
stale error, and service shutdown at sign-out.

This diagnostic trial explicitly revoked live ride listeners before signing out.
The exact experimental source is retained with the original transcript, marker,
primary transfer receipt, four captures and sanitized emulator logs. Cleanup still
failed with the same closed-listener server error. The speculative listener
registry was removed from the application because this experiment did not support
it as a remedy. Its archived source is not the current implementation.

This trial remains negative: passing application assertions do not override failed
fixture cleanup. No physical GPS, real provider, production data or release claim
is supported by this evidence.
