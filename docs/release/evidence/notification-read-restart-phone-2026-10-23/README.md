# Notification Read After a Measured Physical Process Stop

23 October 2026. One fresh disposable Google Pixel 9 Pro / Android 15, using
synthetic accounts and the privately connected `demo-sgm-local-qa` services.
No production data, live payments, map requests, location permissions, device
administration, update policies, or personal devices were changed.

The operator observed three unread parent approval notices. Only "Lecture
choisie QA" was marked read. The other two stayed unread. The independent
observer confirmed that only the selected read/readAt fields changed, with all
169 baseline records, all claims, and live-trip data protected. Only the explicit
parent/driver profile timestamp exclusions apply. Driver/outsider inbox and
foreign-write probes are service checks, not actions attributed to the phone.

The supported native memory diagnostic measured process 18982. The operator
opened this app's Android App info, selected Force stop, and confirmed the
system dialog. The next native diagnostic reported no process found for the
app. A stopped-state checkpoint independently confirmed unchanged records.
The operator then opened the app from its launcher icon: the parent session
returned without typing credentials. The selected alert remained read and both
other alerts remained unread. Native diagnostics measured a new process, 12866.
All stored records and the first read timestamp were identical after reopening.

This is stronger than the earlier same-day account-switch trial, which did not
prove process death. It does not replace a production tracking restart trial.
It does not prove push delivery, iOS, network-loss recovery, or release readiness.
The preflight process was 32730, different from the later measured 18982 before
the accepted stop. The cause of that preparation change is unknown; stable
process lifetime throughout setup is not claimed.

The selected existing APK was visible in the provider UI. Its main client source
at 87082b10 was unchanged on backend head aba016d8. Installed bytes were not
independently hashed in this trial. The exact initially uncommitted observer
source is archived with its dependencies and hashes. The observer itself never
operated the phone, stopped a process, or marked an owned alert read; its record
checkpoints explicitly cannot prove native UI or process death on their own.

Original JPEG stream captures were cropped to the visible app without content
edits or resizing. Four reviewed synthetic captures are publishable. System
confirmation, cleanup screens, native measurements, and raw records stay in the
repository rather than the public portal. No video was recorded.

The operator observed final sign-out. Uninstall was requested from Android App
info but returned to Home; the icon remained and a package probe still reported
installed=true. Uninstall, launcher absence and provider reset are NOT verified.
The remote phone session ended and the dashboard returned. The observer closed,
the owned backend/helper exited 130, both disposable directories and the private
session file disappeared, all four endpoints closed, and RAM credentials cleared.
No global device setting or administration permission was changed.

The read-only `dumpsys meminfo` and `dumpsys package` commands follow the
[provider's supported command list](https://www.browserstack.com/docs/app-live/adb-commands).
An initial `pidof` probe was rejected; no restricted-command bypass was attempted.
`process-*.json` retain visible command responses; the package receipt retains
only the package marker and user installation fragment, not the complete dump.
All artifacts except this narrative and the checksum list are SHA-256 covered.

During subsequent broad validation, the supervision fixture exposed an actual
readiness race: existence of its final file preceded completion of JSON writing.
The failed consumer then removed its directory without aborting the owned group,
leaving the suite open. Only that verified owned group was explicitly stopped.
The fixture now publishes its receipt by atomic rename; every fixture-backed
test closes its group even when the readiness consumer fails. `validation/`
retains the exact before/after sources, a deterministic one-test red run against
the original fixture, and ten passing current supervision tests. These QA fixture
changes do not alter the application or elevate the physical evidence scope.
