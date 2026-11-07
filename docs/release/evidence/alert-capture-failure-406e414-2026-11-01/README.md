# Failed Alert Capture And Restart Copy, 1 November 2026

Native run `41296148302` at `406e414c66bdb17d73765a19499f45c66d8cd9dd`
fails its complete Android UI job. All eleven separately isolated safety jobs
pass; they do not override the full job's failure.

The ordinary transcript contains 280 cases: 225 pass, 54 are skipped and one
fails. Three notification-inbox component cases pass. The withdrawal case reaches
its capture after asserting the empty list and absent old alert, then rejects
the returned bitmap at the unchanged sampled-color quality gate. The original
bitmap is not retained: the diagnostic allowlist at that source covers only
`team-chat-confirmed.png`. Neither a blank renderer nor sparse sampling is proven
as the cause. The new allowlist adds only this reviewed synthetic empty-state
capture, without another capture, retries, replacement or a reduced quality gate.

The connected replay later loses its primary evidence copy at `confirmed-restart`.
The file-sync command exits 1; three immediate diagnostics observe an offline
device. Guest logs record socket closure and a terminated write. The sampled
host daemon identity survives; this does not prove continuous guest execution or
the underlying cause. There is no final successful replay report. Device cleanup
reports removal of local packages and restoration of the installation policy.

Original selected artifacts, parsed counts, API run/artifact metadata and selected
source snapshots are retained. The ZIP digest published by the provider was not
independently matched to downloaded archive bytes; selected snapshots are not a
whole-head attestation. No failed image is published or replaced. Earlier phone
trials and successful historical runs keep their dates and scope. Closed-app
push, production, physical tracking and release acceptance remain unproven.
