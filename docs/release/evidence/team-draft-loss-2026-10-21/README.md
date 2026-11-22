# Confirmed Unsent Team Draft Loss, 21 October 2026

Source `b92ba8682be612ba2fd4666f80a47df50d629971`,
[run 39631451016](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39631451016),
job `119330428472`, terminal failure; original artifact `12360112244`, original ZIP
and metadata are retained. This attempt passed JUnit initialization and reached
the actual app. It is separate from both earlier pre-UI failures.

The first native stage passed: the parent opened its approved team, entered the
private draft and captured it. The independent backend checkpoint found only the
two seeded messages and matching operations; all 158 protected baseline records
and original claims were preserved except permitted sign-in timestamps. The host
then force-stopped the local app and independently observed no remaining process.

The second stage verified a different process and the same authenticated parent,
reopened the same team and captured an empty composer. Its unchanged assertion
failed: expected `Brouillon équipe après fermeture QA`, but actual text was empty.
The failure occurs before the parent UI send. No third-process case or final
stored-state verifier was reached. This is not a completed restart/send flow or
release evidence. Two unedited full-window captures were reviewed and published;
root originals remain retained. The device restoration receipt independently
verifies policy, temporary administrator and local-package cleanup.

The root cause is the route's `rememberSaveable`-only composer holders: no durable
team draft storage exists in this tested source. The correction adds scoped
private storage, preserves the stable pending-send identity before a network
write, and clears that record only after acknowledgement. Read failure does not
create an empty composer; write failure keeps typed text and blocks sending.
Ten new state tests cover restoration, identity retention, isolation and failure
paths. This correction is not claimed native-verified by the failed artifact;
the same three-process assertions must pass on its later source before acceptance.
