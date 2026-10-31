# Controlled Offline Review Retry, 30 October 2026

One physical Android phone, two isolated accounts and two fixture-completed trips
with the same title and different dates. No production data, payments or map calls.
The selected debug APK uses the private localhost transport and current application
source b015934. Installed bytes were not independently verified.

The parent sees both dates. With the provider's offline mode enabled, tapping five
stars for 29 October produces an inline failure while both trip cards remain.
Independent records contain zero ratings. Restoring connectivity does not submit
automatically: zero ratings remain before the explicit retry. Retrying records
exactly one five-star review for 29 October; the 28 October request remains.
After manual Android Force stop and reopening, the parent retains the older
request. The driver sees 5.0/5 and one received rating, with both own requests
intact. Both accounts signed out. Eight independent stored-state checkpoints pass.

The transient sending spinner was not captured: the two offline checkpoints were
collected after the failed attempt and prove stored-state invariants only. Manual
Force stop was observed, including its disabled state, but no independent PID
sequence was collected. Do not promote this to independently measured restart.
Controlled offline mode on physical hardware is not a real-world radio-loss test,
a physical lost acknowledgement after commit, an iOS test or release acceptance.

The first provider session ended before authentication. An earlier preparation
resumed the app offline and showed a metadata error; restoring connectivity
recovered both cards. That preparation is retained separately from the successful
foreground-only retry. The metadata-refresh failure behavior remains a separate
test scope, not a claimed repair.

Public images are original reviewed JPEG crops of the session window, not native
device exports or video. Original bytes are unchanged. Initial retention rejected
the incorrect PNG extension; the content was JPEG. Only extensions/references and
their inventory were corrected; no image was re-encoded. The original failed
retention bundle remains in the private trial directory.

Network defaults were restored. The remote clipboard was replaced with harmless
text and the host clipboard restored. Owned runtime/helper processes, private
session material and six endpoints were independently checked absent/closed.
The provider's uninstall inventory incorrectly reported no user apps. A native
uninstall attempt returned Home, but a fresh diagnostic still found the package.
The disposable device session was explicitly ended and its idle dashboard
observed. Independent package deletion is not claimed; retain that cleanup limit.

At b015934, the full native job 123799409619 in run 40974599708 was cancelled
during its integrated replay. Its earlier ordinary matrix reports 198 passes,
54 skips and zero failures, but this is not a complete native-gate pass. The
focused lanes and web/backend checks passed; the cancellation cause is not
confirmed by the retained status. The original full log stays in the private
trial directory; no credentials or raw logs are published on the portal.

The average/count display is the owner's requested scope. Full current CI,
physical post-commit reply loss, iOS, tracking, safety audit and operational release
requirements remain separate. See checksums and original records for provenance.

Local verification: 547 backend units, 214 focused retained-evidence regressions
and all 2,821 root Node cases pass. The first broad run retains eleven stale
portal date/gallery expectations; the correction keeps all 38 earlier images,
their dates and the four-step tour, while separately checking five new images.
Twenty actual local browser cases cover those images at widths 320, 390, 768 and
1440. No application behavior or infrastructure was changed in this evidence task.
