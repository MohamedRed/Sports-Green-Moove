# Capture Failure After Resume Assertions

The continuous-sensor trial reached startup, rejected a future position without
starting sensing, and resumed with a retained capture without the previous error.
It then failed at the original resumed-screen image copy: Compose reported
`Failed waiting for PixelCopy!`. The entire original case remains failed (59.326
seconds); no completed marker or positive host report exists.

The retained diagnostic image and redacted semantics tree show the active ride
after that failure. They are diagnostics, not substitutes for the missing primary
resumed capture or the unexecuted sign-out assertions.

The next source-specific trial uses one primary native-display capture method
after an explicit rendered-frame commit and asserts the expected screen before
and after copying. It does not retry a failed capture or substitute a secondary
image into this failed result. Shared captures for other user flows are unchanged.
The whole case, primary transfer, isolation and disposal must still all complete.
