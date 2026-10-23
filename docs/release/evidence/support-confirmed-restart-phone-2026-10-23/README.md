# Connected Support Restart Trial

One physical Pixel 9 / Android 15 used the existing local debug APK, SHA-256
`10668e27abfc95e19256bb484860efe34770e08a5169c43ab2b605c25630d0fb`.
Native sources are unchanged from the previous pinned build; only the independent
controller protocol is modified in this trial. Its exact sources are retained.
All accounts and data are disposable, in `demo-sgm-local-qa`. No provider payment,
map request, production write, device administration or network change occurs.

## Observed Sequence

1. The parent fills the synthetic text and enables Urgent. One Send commits one
   report and one operation. The real handler response is held, not fabricated.
2. Before confirmation, Android App info > Force stop > OK stops the app. The
   disabled Force stop button is captured. Only then is the handler released.
   This trial stops an in-flight request; it does not claim a timeout or outage.
3. Reopening restores the parent session, text, Urgent and explicit Retry without
   retyping. A history-list detour does not submit anything. The later deliberate
   Retry is the second and only reused handler attempt, with the same identity.
4. The confirmation clears the description and Urgent. A second Android Force
   stop > OK and reopen leaves a blank description, Urgent off and Send, not
   Retry. The independent checkpoint still finds exactly two handler attempts.

All ten independent checkpoints complete and verify the same 158 baseline root
records and actor claims, not only the new request. The foreign account cannot
read or list it. The controller never submits a report, drives the phone or proves
its process/network state. `foreign` and the final `restored` are service-only
observations after the phone evidence; `restored` is not a physical account switch.
Their timestamps retain the long gap after 00:18 UTC rather than implying a
continuous session. Completion is recorded at 11:09 UTC.

Four reviewed, exact 250 x 562 stream rectangles accompany their unchanged browser
originals. The capture index preserves original filesystem capture times. They
show preparation, pending state, confirmation and the blank post-confirmation
reopen. No video or final physical history/details read is claimed. The published
capture map is an allowlist for the local portal build, not proof of publication.

## Limits And Cleanup

The phone dashboard is later observed instead of the device. Its end time and
cause are unknown. A coordinate action intended for the phone starts a replacement
device request on the dashboard; that request is cancelled and no replacement
phone is used. The final dashboard state is retained. Uninstall and physical
storage clearance cannot be verified on the ended phone.

The controller closes, the helper exits with its group-cleanup acknowledgement,
and its private directory is absent. The owned backend exits 130; its private
runtime/session credential file is removed and ports 5001/8080/9000/9099 refuse
connections. The phone's ephemeral credentials no longer have a live backend.
No phone policy, network or store setting needs restoration in this trial.

The supported diagnostic panel becomes unavailable. No PID or SDK-call trace is
measured, and no explanation of earlier extra handler attempts is inferred.
Android's native stop dialogs and disabled controls are visual observations,
separate from the prior trial's PID/no-process/new-PID evidence. Real network
loss, urgent escalation, iOS, release tracking and final release acceptance stay
open. The Site remains unpublished pending restoration of owner-private access.

## Controller Use

Select `connected-process-restart` explicitly as the fourth controller argument.
Record `prepared`, then the real UI send's `committed` and `unconfirmed` states.
Actually force-stop the native app **before** issuing `release`; otherwise a late
success may acknowledge and clear the draft. Record `stopped` only after release,
then `reopened`, explicit UI Retry, `confirmed`, a second native stop,
`confirmed-stopped`, reopen, `confirmed-reopened`, service-only `foreign` and
`restored`, then `finish`. Phase names alone never establish phone observations.
