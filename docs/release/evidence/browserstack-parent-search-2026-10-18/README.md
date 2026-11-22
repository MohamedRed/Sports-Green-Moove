# Physical Parent Search And Session Checks, 18 October 2026

Manual App Live test on a physical Pixel 8 / Android 14 using the existing
subscription. Source `a4e933d20d9219a4e0fdcb266cfb9cb31d8619f4`; isolated APK
SHA-256 `3fe75d6404f557d61bc7a3a0f21ad1c58df6c97894d5bb171e754ff280299bca`.
Package `be.sportgreenmoove.app.local`, demo project and `127.0.0.1` host.
Live providers and map-display credentials were disabled. No Terraform change.

## Observed

1. Created a fresh synthetic parent through the native registration screen.
   Auth independently reports only the parent role. No credentials are retained.
2. Prepared one synthetic child/guardian relation through the isolated fixture
   SDK, not the child-registration or guardian-consent screens (`fixture.json`).
3. Used Kill App(s), observed the Android launcher, opened the app drawer and
   relaunched the app. Authenticated home returned without another sign-in
   (`phone-session-restored.png`). This is not a ride restart or GPS test.
4. Opened search. The fixture child was available. Selected two seats and the
   guardian-consent option (`phone-child-two-seats-consent.png`).
5. Selected Aucun. The child selection cleared and the consent option reset;
   the two-seat selection remained (`phone-child-consent-reset.png`).
6. Re-selected the child and tapped Trouver un trajet with both addresses empty.
   The app required resolved addresses and did not submit a booking
   (`phone-child-incomplete-search.png`). The final independent checkpoint found
   zero bookings and zero booking-request receipts for this parent.

All four images are original, reviewed 1080 x 2400 native device screenshots.
Only the private website's generated JPEG derivatives are recompressed.
The parent display name reflects the remote keyboard's entry; it is synthetic.

## Limits And Cleanup

This is selection, consent-reset, incomplete-search and signed-in-session proof,
not a completed child/two-seat reservation, consent audit event, successful map
search, tracking, payment, push delivery, two-phone or iOS test. Release manifest
acceptance is unchanged. There is no new video; this session did not record.

Two driver-decision fixtures were also prepared, but the driver was not signed
in on the phone and no decision was made. Private credential entry could not be
completed through the available UI. A blocked file-URL read was not bypassed;
there is no driver-screen proof from this session. Future driver tests need a
manual sign-in handoff or an approved supported credential-entry path.

The active helper's exact four-port loopback allowlist and disabled Force Local,
verbose/API logging, MITM, folder and extra-host settings were read back and
validated. App Live showed its local connection. After these checks the phone
session was stopped, helper disconnection was confirmed, owned helper and local
service processes were stopped, and both private credential files were removed.
No real users, cloud data, payment or plan changes occurred.
