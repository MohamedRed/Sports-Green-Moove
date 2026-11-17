# Android Team Alert Consumer Preparation

The Android app now accepts an opaque team-message data envelope, schedules durable
WorkManager processing, revalidates the current installation/account/admission via
`resolveTeamPushAlert`, and posts only generic native notification text. Its
immutable explicit intent carries the alert ID, account and local epoch, never a
message, child identity, private proof, token or client-selected team destination.
Cold and warm activity paths enter the authenticated app gate. A second tap on
the same alert starts a new authority read instead of reusing an earlier screen.

The current-account epoch, confirmed registration and revision are checked before
and after the remote result. Registration refresh is serialized with resolution.
Sign-out invalidates authority before notification cleanup. Permission withdrawal
also persists an idempotent removal immediately, before asynchronous cleanup, and
rejects a response already in flight. Resume, explicit retry and account changes
discard the prior view. The actual team route still performs its own current
history/admission checks before returning messages. Alert opening never silently
acknowledges a notification or a team message.

The source-bound local build passes 790 JVM cases, including twenty focused cases,
and compiles seven route plus four Android platform cases. Both isolated APKs are
hashed; the emulator build explicitly disables real messaging initialization and
the receiving service. No native UI case, WorkManager attempt, system notification,
provider SDK token operation, notification tap or phone receipt is executed by
this retained local build. The earlier sign-out and server evidence stays separate.

The existing focused team-read phone now runs its original read and exit cases,
then the new route/platform cases. Only its disposable local package receives a
temporary notification permission. A separate receipt verifies restoration even
when a test fails. One native notification test is intentionally skipped in the
ordinary suite and enabled explicitly in that focused trial. No extra matrix
phone, production account, map request, payment or paid infrastructure is created.

WorkManager coalesces unfinished duplicates; a stable notification tag replaces
one still-visible alert. Neither mechanism is an exactly-once guarantee across
process interruption or dismissal. This work does not implement the server outbox
dispatcher, automatic iOS receipt, provider retry/uncertainty policy or physical
delivery/tap/permission/revocation/sign-out evidence. All six operational push
requirements and all physical tracking and safety-audit gaps remain pending.

Publish only a short local-result note. No new public media is accepted from this
build, and no historical phone date, gallery, tour, partial status or public Site
audience changes. Native CI execution and real phone/provider proof remain distinct.

Implementation references: [Android background message handling](https://firebase.google.com/docs/cloud-messaging/android/receive-messages),
[message processing lifecycle](https://firebase.google.com/docs/cloud-messaging/android-message-priority),
and the [WorkManager 2.10.5 release](https://developer.android.com/jetpack/androidx/releases/work#2.10.5).
