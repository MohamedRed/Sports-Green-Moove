# Failed Confirmed-Message Restart Recheck

Native CI run **38967464746**, source **c2ee8150166552f955cd29f4fe72aecaacafbbee**,
isolated run **872318b3ba7f11359f0945d2bc1701a8**, failed on **2026-10-16**.
This is retained failure evidence, not an accepted complete replay.

The ordinary component XML reports 73 cases, zero failures and 16 intentionally
skipped local/live cases. That does not prove the separate isolated app replay.
The restart preparation passed and the host issued/verified a different-process
restart. The resumed app restored the parent's session and confirmed history,
then sent the next parent message. Its driver reply timed out waiting for the
draft to clear after 60 seconds. No driver `sendChatMessage` request appeared
between opening that conversation and the timeout. The after receipt is
`completed: false`, without driver-reply/read acknowledgement evidence.

The ordinary component logcat for this method describes its intentionally skipped
non-local invocation, not the later failed local invocation. Do not use it as a
failure diagnosis or combine component passes with incomplete local receipts.
The console's running progress counter also exceeded its 73-case target; the
actual component XML remains the authority for the distinct ordinary test count.

No completed `results.json`, final persisted-message verification or response-loss /
network-recovery stages were produced after the restart failure. The failed-screen
capture was absent because the catch ran after `ActivityScenario.use` closed the
activity; this absence must not be replaced by an older successful image.

## Input And Diagnostic Changes

The former restart send helper replaced text without establishing focus/IME
readiness and tapped immediately after keyboard dismissal. The main chat and
network tests already use a stronger actual-input protocol. The restart helper
now waits for a focused window, explicitly focuses the composer, observes the
real keyboard, enters the text, hides it and waits for the original layout before
one actual send touch. The same 60-second acknowledgement gates remain.
There is no semantic-click bypass, resend, skip or longer send deadline.

Failure capture and phase/layout diagnostics now occur while the activity is
still open. Diagnostics contain dimensions, visibility and draft length, not
credentials or message content. Fresh host acceptance also requires confirmed
input phases from both app stages; historical receipts retain their original
contract and bytes. Compilation/configuration checks are not a successful app
replay. A verified root cause and complete current-head replay are **not established**
by this retained failure or the input changes alone.

The original six JSON/XML/transcript files are byte-pinned by SHA-256. No production
data, physical device, live payment or release-manifest acceptance is involved.
