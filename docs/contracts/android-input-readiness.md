# Android Input Readiness

The ordinary screen suite on commit `bd7aec7`, run
[39031056051](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39031056051),
failed seven cases before typing. Its unchanged XML is retained in
`docs/release/evidence/local-dual-transport-2026-10-17/repeat/general-ui.xml`.
The collected logs report `PHASE_CLIENT_REQUEST_IME_SHOW` failures. In Android 15,
[`InputMethodManager.requestImeShow`](https://android.googlesource.com/platform/frameworks/base/+/android-15.0.0_r1/core/java/android/view/inputmethod/InputMethodManager.java)
records that phase when there is no served view or its window token differs from
the requesting window. A focused Compose semantics node alone is not proof of
native window/input readiness. This identifies the failed platform condition, not
the complete cause of every previous test failure.

`InputWindowReadiness` obtains the field's own Android composition through
[`SemanticsNode.root`](https://github.com/androidx/androidx/blob/androidx-main/compose/ui/ui/src/commonMain/kotlin/androidx/compose/ui/semantics/SemanticsNode.kt)
and its testing view. Before touching the field it requires attachment, a window
token, a resumed lifecycle and native window focus. A dialog uses its own root,
not the host activity or an arbitrary globally visible window. The existing login
interaction already waits for native window focus; conversation and trip-form
helpers now enforce the same prerequisite. This is a test-harness correction;
it does not change production input handling or mark the failure resolved.

The existing real keyboard waits remain five seconds for conversation components
and 15 seconds for trip forms. Actual keyboard visibility remains mandatory, as
do field text checks, touch-based send/confirm controls, send-error waits and
independent persistence assertions. No forced focus, keyboard command, synthetic
visibility, sleep, retry, provider substitution or production permission is added.
Trip forms now inspect IME insets on their own root rather than accepting any
other window's visible keyboard. Readiness and failure logs contain booleans and platform enum values,
never field values or credentials. Editor-service inspection occurs after the
keyboard outcome, not as a preparation step that could reconcile input focus.

The repeat at `b72ee7f` failed nine ordinary cases at this native-window prerequisite,
including both dedicated probes. Its retained logs show attachment, a token and a
resumed lifecycle, but no native window focus. They do not establish whether the
display, lock screen, window visibility or another window caused that condition.
Readiness logs now also observe interactivity, keyguard/device lock, root visibility,
window visibility and display state. These are booleans or platform enum values;
no window titles, field contents, identifiers, shell dumps or credentials are logged.
The observations do not wake/unlock the device, change focus, extend deadlines or
turn an unobserved cause into a claimed fix. They still require a fresh executed
failure or success before drawing conclusions.

Two instrumented probes exercise an activity field and a separate dialog field.
Compilation and static checks do not prove the runtime outcome. A fresh native
run must execute both probes, all seven previously failed cases, and the separate
full native/backend replay. Retain any failure without weakening these checks.
Even a passing run does not close phone keyboard/layout, map rendering, physical
tracking, live payments or safety-audit requirements.

The [first observed result](../release/evidence/local-input-readiness-2026-10-17/README.md)
passed both probes and all previously failed cases, but the independent network
preparation still failed. Pre-touch windows were already focused in the retained
samples, so causality and repeated-run reliability remain unproven.
