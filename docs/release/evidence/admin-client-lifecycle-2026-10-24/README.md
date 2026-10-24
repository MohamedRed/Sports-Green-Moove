# Replay client shutdown regression - 24 October 2026

The aba016d8 Native run 40041012845 was cancelled by the 35-minute job limit.
Its aggregate reports 37 passed local steps / 40 native cases after 159 ordinary
passes, 52 skips and no ordinary failure. This is not whole-workflow success:
not every scenario artifact has been independently revalidated, and final
cleanup acceptance remains false. The retained overview identifies that boundary.

The replay did not close its Admin Realtime Database connection or Firestore
client. A separate real-SDK trial on disposable local emulators reproduces a
process remaining live after both reads. Its owned process group is explicitly
stopped. With awaited Firestore termination and app deletion, both success and
the original task-error case exit naturally, without process.exit or an extended
workflow deadline. Both public close operations acknowledge completion; the app
registry is empty. The disposable environment is removed and all four ports close.

The first fixture attempted an invalid query after Firestore termination and
failed before its receipt. Its transcript is retained separately. The corrected
fixture observes the actual public close operations and natural process exit;
it does not issue queries through an already terminated client.

The d5f3e9c7 replay (40044293982) was explicitly cancelled after reproducing this
root cause, not restarted because a polling window expired. The corrected full
native replay is still required. This local regression does not accept phone UI,
physical tracking, production activation, payment, push or release readiness.

The source snapshots and source hashes bind the successful trial to its tested
implementation. Root Node contracts: 1995 passed, zero failed before adding this
dated evidence and progress update. No new app screenshot or video is accepted.
