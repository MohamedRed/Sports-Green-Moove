# Local Network Handover

## Required Scenario

Fresh version-2 replays require both radios enabled, a real Wi-Fi default network
and an available cellular internet network. Disabling Wi-Fi must yield an
exclusive cellular observation before mobile data is disabled. Offline means no
active/internet network and an unreachable isolated Functions endpoint. The real
send fails without losing its draft; explicit retry after restoration must yield
one message, one notification, correct read state and a cross-account reply.

Version 2 also requires Wi-Fi to be the default again and both internet transports
to be present after restoration, not merely enabled radio switches. The exact
observations that release the preparation, cellular and restoration waits are
persisted. Existing 30-second network waits and 90-second send-error wait remain.

## Explicit Transport Demand

`LocalEmulatorNetwork` previously requested cellular internet but assumed enabled
Wi-Fi would remain available without its own request. The failed run on
`8605f03` had a loaded SIM, valid default-data subscription and connected cellular
internet, but no Wi-Fi internet network. That is not the earlier missing-SIM
failure and cannot be accepted as a Wi-Fi-to-cellular handover.

The harness now requests both internet transports using ordinary
`ConnectivityManager.requestNetwork` calls, with no network specifier. AOSP's
[Wi-Fi network factory](https://android.googlesource.com/platform/packages/modules/Wifi/+/refs/heads/main/service/java/com/android/server/wifi/WifiNetworkFactory.java)
handles a generic Wi-Fi request by enabling trusted auto-join demand. This is the
basis for the change, not proof that the recorded failure's exact OS cause is
already resolved. The next actual replay must establish that outcome.

The requests do not bind the app or individual sockets, select an SSID, force a
subscription, change validation state or substitute another transport. They stay
registered through the recorded offline/restored phases and are both released.
Setup and cleanup preserve the primary failure and attempt every release. The
existing debug/demo-project, loopback endpoint, app-package, explicit disposable
session and emulator identity guards run before either request starts. No new
production permission, provider, paid resource or app behavior is introduced.

## Historical Evidence

`assertCellularRequestSetup` remains a version-1 verifier for retained evidence.
Fresh collection uses only `assertTransportRequestSetup`, which requires version 2,
both releases and actual Wi-Fi-default observations before and after loss. It
cannot accept an older result as a substitute. Earlier successful messaging
recovery over cellular remains historical evidence of that narrower behavior;
its restored Wi-Fi switch did not establish a restored Wi-Fi connection.

This isolated replay is not physical GPS, background tracking, production-provider,
push, live payment or final release evidence. The full goal remains active.
