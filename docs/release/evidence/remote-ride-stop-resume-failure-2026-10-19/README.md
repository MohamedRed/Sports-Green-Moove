# Remote Completion: Resume Harness Failure

The service stopped before the app returned, with the original driver still
authenticated. The peer completion checkpoint and baseline isolation report
are retained. However, the complete native case failed at
`ActivityScenario.moveToState(RESUMED)`: the task remained behind the launcher.
No successful completed device marker or final report is accepted.

The [AndroidX invoker source](https://github.com/android/android-test/blob/main/core/java/androidx/test/core/app/InstrumentationActivityInvoker.java)
shows that its resume operation closes the helper activities used by its own
state transitions. This is not a task-return operation after `moveTaskToBack`.
The next harness version uses an explicit `REORDER_TO_FRONT` intent, still waits
for the same scenario to reach RESUMED, and keeps every subsequent UI assertion.
There is no retry, alternative screenshot or weakened service-stop condition.

This partial result is not a complete native flow, physical background GPS,
provider validation, safety audit acceptance or production deployment.
