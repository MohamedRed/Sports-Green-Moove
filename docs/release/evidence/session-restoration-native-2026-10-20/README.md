# Session Restoration After Controlled Failure And Actual Rotation

Native CI run [39415695486](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39415695486),
source `bf7e5aacea86ed872c078856d6cc2fd4bab52ee4`, isolated run
`41d5d800dc9ced46a1b3baa1c0bd28f7`. The independent restoration job
`118604032135` completed successfully, including cleanup and artifact upload.
Artifact `12261907492` is the original `android-focused-safety-ui-session-restoration`
export. Its provider-reported ZIP digest is retained in `artifact-metadata.json`;
the unpacked original files are independently SHA-256 pinned, not a claim that
the ZIP digest was locally reproduced or cryptographically attests the device.

## Observed Result

One actual local app/SDK instrumentation case passed in 15.255 seconds. The
existing synthetic parent is signed in through the real Auth SDK and profile
callable before the full app launches. The default Functions SDK is then directed
to the isolated fault proxy; no application gateway or screen is replaced.

- Initial profile restoration receives an explicit controlled 503 error. The app
  shows its generic error, Retry and Disconnect, not login or signed-in content.
- A real portrait-to-landscape configuration change recreates the Activity and
  receives a second error. The parent identity and accessible actions remain.
- After forwarding is enabled, pressing Retry restores the same parent to Home.
- Returning to portrait recreates the Activity again and restores the same Home.
- The profile shows the expected synthetic parent's name and email.

The original proxy receipt has exactly four profile requests: 503, 503, 200, 200.
Two read-only active-ride requests succeed only after recovery. No automatic
restoration retry, silent sign-out, hidden exception detail or privileged account
switch is accepted. The controlled 503 is not a physical network outage or a
reproduction/explanation of the earlier `unexpected end of stream` cause.

## Evidence And Cleanup

All five original PNGs, marker, transcript, transfer receipt, app/final reports,
proxy receipt, continuous-device setup/claim/restoration and case status are
retained. `artifact-sha256.json` pins 18 original/context files. All 27 source
bindings are preserved byte-for-byte in the shared source archive with Git
provenance. The independent case's CI metadata is retained while the wider
workflow is still running; this directory does not claim that whole run passed.

All five captures were visually reviewed. Four enter the partner gallery and
tour: initial error, landscape error, landscape recovery and portrait recovery.
The profile-identity capture remains repository-only: its unrelated pre-existing
static profile labels are outside this restoration test and are not presented as
newly verified settings. No image is edited, cropped inside the app or fabricated.

The account is signed out, the local Functions endpoint restored, orientation
settings restored, Firestore terminated and proxy closed. Five Auth accounts'
claims, all 13 top-level fixture collections and live trips are unchanged except
the selected parent's expected profile timestamp. This is not a recursive audit
of every subcollection. The owned local runtime is destroyed and its four service
endpoints close; both app packages are removed. Outer cleanup independently
confirms the continuous install guard, restores store/background/launcher state,
and removes the temporary administrator and its helper. A store process being
awake is recorded, not treated as loss of the verified installation restriction.

## Remaining Scope

This is local full-app evidence with controlled callable rejection, not a physical
device or real network-loss result. Disconnect from the error still has only the
separate controlled component coverage; it was not clicked in this native case.
Loading/cancellation races, the earlier transport failure's cause, account
switching elsewhere, live providers, physical tracking, payments, safety audits
and store review remain separate requirements. No backend or application is
deployed and no existing release-manifest item is accepted by this trial.
