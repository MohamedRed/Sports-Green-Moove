# Android Recheck at a226b3e

Run `41920203762`, main job `126890385415`, is terminal failure at
`a226b3e265c78f58d56af892a666ae2778afc50b`. Twelve focused lanes pass separately.
The two new readiness regressions both pass, at indices 59 and 60: a permanently
absent composition times out and the delayed matching composition is found.
Their exact contiguous start/terminal packets are retained unchanged.

The ordinary command still reaches its unchanged 720,000 ms deadline, this time
after 318 cases finish and case 319 starts out of 351 discovered. It has no final
runner result or complete ordinary report. The existing strict transcript parser
rejects it with `One complete runner result is required`; no synthetic terminal
packet or complete XML is added.

The independent parent replay passes its login readiness wait, then loses the
composition while `openGuardians` calls `performScrollTo` at line 81. This is not
the previous first-login-wait failure, and the passing readiness cases do not fix
the later missing interface. Failure cleanup observes a directory that does not
exist. Exit information reports a force stop due to finished instrumentation,
not an established cause of the disappearance. The ordinary slowness and missing
interface remain unexplained. Earlier boot-time offline messages do not establish
the cause of this later failure.

Records are selected unchanged entries from artifact `13367313439`. Their hashes,
the original ZIP digest, tested Kotlin-source fingerprints and terminal job
inventory are retained. The original archive stays private; no new media is
published. Host disposal observes the disposable process gone. No retry, new
timeout, fallback, paid-map request or physical-device acceptance is added. The
historical 3e7cd40 pass remains separate; this recheck does not pass the full gate.
