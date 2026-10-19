# Original Closed-Stream Cleanup Failure

The second independent native trial passed its stronger original case in 52.522
seconds and transferred all four captures. The resumed screen no longer retained
the earlier error. End-to-end acceptance still failed during fixture cleanup.

Unlike the first trial, this one retains sanitized emulator logs. The Firestore
emulator raised `StreamTransportClosedException` / `Stream is already completed`
from `ListenStreamManager.notifyDocumentListeners` while committing cleanup, and
returned gRPC UNKNOWN to the host. This is not a successful fixture cleanup.

The next trial explicitly awaits the test client's pending writes and terminates
its Firestore instance after closing the activity and signing out, before the
instrumentation process ends. That teardown must succeed as well as the original
assertions and cleanup; no database failure is ignored or retried into acceptance.
This artifact remains negative and does not prove physical tracking.
