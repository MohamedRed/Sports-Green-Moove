# First Resume Did Not Complete

The first trial with the approved whole-environment disposal policy failed its
original Android assertion after 118.368 seconds. The two explicit callable
submissions completed, but the first resume did not reach the pickup control
within its existing 60-second deadline. This is an application-case failure, not
a successful startup or a per-record cleanup failure. No positive report exists.

The diagnostic did not retain the in-activity error screen, so it does not prove
why acquisition or resumption failed. The next source-specific trial supplies a
continuous synthetic fused-location feed during each startup attempt, retaining
the same capture timestamp to exercise the duplicate contract even when backend
reads are slow. It also captures the visible screen and a redacted semantics tree
before closing the activity on failure. Sensor errors and shutdown remain fatal;
the application assertions and deadlines are unchanged.

This trial used the updated development CLI 15.34.0 / local Firestore 1.22.0.
That update is not evidence of a vendor cleanup fix: per-record deletion was not
part of this newly approved policy. No physical or release claim is made.
