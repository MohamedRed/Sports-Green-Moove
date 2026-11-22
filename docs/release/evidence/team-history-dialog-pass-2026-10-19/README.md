# History Dialog Capture Pass

Original artifact `android-connected-ui-test-results` from Native CI run
39255684112, source b20d5ce3656e94b97cd7e105a95aefba38e8b795.

The ordinary suite executed 120 of 154 cases, with 34 intentionally skipped,
zero failures and zero errors. All four history component cases passed. The
redacted-child dialog uses the dialog root; its device-window companion retains
the surrounding screen. The reviewed dialog shows the unavailable child label,
approved status and close action, without a withdrawal action or clipped text.

These are component tests with an explicit fake gateway, not physical-device,
production, conversation, tracking or complete-release evidence. The source
predates the emergency child-identity correction. It cannot validate that change.
The original failed capture remains in `../team-history-dialog-failure-2026-10-19/`.

The unmodified XML, exit-status receipt, disposable-device restoration receipt
and four original PNGs are bound by `artifact-sha256.json`. Source hashes identify
the exact retained source versions, independently of later branch changes.
