# Private Transport Probe, 25 October 2026

A fresh physical Pixel 9 Pro / Android 15 runs a separate disposable diagnostic
APK, not Sports Green-Moove. The app has only INTERNET permission, no accounts,
no provider credentials and no input for arbitrary destinations. It makes one
ordinary HTTP request and one bounded direct socket attempt to 127.0.0.1:9000.
The owned server serves only a fixed marker path. No Firebase fixture or customer
data is involved. The existing private helper remains restricted to the same
four loopback service ports; Force Local, logging and MITM remain off.

The reviewed original phone view shows HTTP `VERIFIED_204`, native socket
`ECONNREFUSED`, and 202 ms total elapsed time. The server independently records
exactly one marker request. Thus an ordinary request reaching the private server
does not establish that this phone can reach it through a direct native socket.
The exact cached Firebase Database 22.0.1 bytecode is also inspected: its plain
WebSocket branch constructs `java.net.Socket(host, port)`. Combined with the
earlier disconnected SDK traces, this identifies an isolated test-route
prerequisite, not a proven production UI defect or universal provider limitation.

The provider's [TCP troubleshooting guidance](https://www.browserstack.com/support/faq/local-testing/local-exceptions/why-are-my-tcp-connections-failing-during-local-testing)
also distinguishes proxied HTTP requests from direct raw socket connections.
This supports the observed route distinction, not a claim that all WebSocket
connections or all provider configurations fail. No alternate route is enabled.

The app-source snapshot and uploaded APK checksum are retained; the installed
phone APK is not independently rehashed. Screenshots are original browser
captures, not native-resolution exports, and are internal only. They are not
user-flow or release completion evidence. No polling, SDK substitution, public
tunnel, proxy override, production edit or workaround is installed.

Uninstall is acknowledged, the phone session stops, the owned helper group exits
and its handoff directory is absent. The marker server exits and all four
loopback ports pass a bind/close check. Package absence is not independently
proven. The external build folder is retained as evidence, not a deployed app.

Separately, commit 2535942 selects Android's supported `-gpu software` mode for
the full UI gate, replacing the action's deprecated `swiftshader_indirect`
default. Screenshot assertions, blank-image rejection and primary collection
remain unchanged. The red contract test and 2225-case green local suite are
observed. Baseline run 40224057532 subsequently fails primary capture collection
after 166 ordinary cases pass and 54 are skipped; all ten focused trials pass.
Candidate run 40224919474 is still pending at this record's creation, with all
ten focused trials passing. Neither result establishes a renderer root cause.
Deprecation is confirmed by [Android's graphics documentation](https://developer.android.com/studio/run/emulator-acceleration#accel-graphics).
This configuration change is not yet proof of the PixelCopy or device-transport
root cause, and neither the full gate nor physical tracking is accepted here.
